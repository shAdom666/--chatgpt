"""Fit the layered garment to conservative leg volumes after the coarse drape solve."""
import numpy as np
import drape


def samples(avatar, first, size):
    points, indices, weights = [], [], []
    for part in avatar.parts.values():
        joints = np.asarray(part['j'])
        selected = (joints[:, 0] >= first) & (joints[:, 0] < first + size)
        if selected.any():
            points.extend(np.asarray(part['p'])[selected])
            indices.extend(np.clip(joints[selected] - first, 0, size - 1))
            weights.extend(np.asarray(part['w'])[selected])
    points = np.asarray(points)
    # Nearby vertices from the same pleat have practically identical skinning.
    _, keep = np.unique(np.round(points / .007).astype(int), axis=0, return_index=True)
    return points[keep], np.asarray(indices)[keep], np.asarray(weights)[keep]


def fit(avatar, times, frames, pose_at, quat):
    rest = drape.cage().reshape(-1, 3)
    size = len(rest)
    source, joints, weights = samples(avatar, avatar.bones[drape.control(0, 0)], size)
    for time, frame in zip(times, frames):
        hips, root, capsules, _ = drape.leg_geometry(avatar, pose_at(time)[0], quat)
        cage = frame.reshape(-1, 3)
        delta = cage - rest
        previous = delta.copy()
        # Each garment patch has an outside. Keep the front skirt in front of the
        # knees even when a deep fold initially puts samples on the far side.
        rings = frame - frame.mean(axis=1, keepdims=True)
        outside = rings.reshape(-1, 3)
        direction = (outside[joints] * weights[..., None]).sum(axis=1)
        direction /= np.maximum(np.linalg.norm(direction, axis=1, keepdims=True), 1.e-8)
        bodies = [((a-root) @ hips+root, (b-root) @ hips+root, r+.018)
                  for a, b, r in capsules]
        allpoints = source + (delta[joints] * weights[..., None]).sum(axis=1)
        near = np.zeros(len(source), dtype=bool)
        for a,b,r in bodies:
            near |= ((allpoints >= np.minimum(a,b)-r-.15) &
                     (allpoints <= np.maximum(a,b)+r+.15)).all(axis=1)
        p, ix, w, outward = source[near], joints[near], weights[near], direction[near]
        for iteration in range(24):
            x = p + (delta[ix] * w[..., None]).sum(axis=1)
            disp = np.zeros_like(x)
            for a,b,r in bodies:
                axis = b-a
                fraction = np.clip(np.sum((x-a)*axis, axis=1)/np.dot(axis,axis), 0, 1)
                sep = x-a-fraction[:,None]*axis
                dist = np.linalg.norm(sep,axis=1)
                hit = dist < r
                if not hit.any():
                    continue
                normal = sep[hit]/np.maximum(dist[hit,None],1.e-8)
                guide = outward[hit]
                align = np.sum(normal * guide, axis=1)
                normal += np.maximum(0.,.38-align)[:,None]*1.65*guide
                normal /= np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1.e-8)
                disp[hit] += (r-dist[hit,None])*normal
            amount = np.linalg.norm(disp,axis=1)
            if amount.max(initial=0) < .001:
                break
            hit = amount>.0002
            j, blend = ix[hit], w[hit]
            priority = amount[hit,None]**2
            denom = np.bincount(j.ravel(), weights=(blend**2*priority).ravel(), minlength=size)
            update = np.column_stack([np.bincount(j.ravel(),
                weights=(disp[hit,k,None]*blend*priority).ravel(),minlength=size) for k in range(3)])
            update /= np.maximum(denom[:,None],1.e-12)
            update *= np.minimum(.66,.026/np.maximum(np.linalg.norm(update,axis=1,keepdims=True),1.e-8))
            # Laplacian spreading avoids a pointed hem just beyond a contact.
            correction = (delta-previous+update).reshape(frame.shape)
            neighbors = (np.roll(correction,1,axis=1)+np.roll(correction,-1,axis=1)+
                         np.concatenate((correction[:1],correction[:-1]))+
                         np.concatenate((correction[1:],correction[-1:])))*.25
            delta = previous + (.90*correction+.10*neighbors).reshape(-1,3)
            delta[:drape.PANELS] = previous[:drape.PANELS]
        cage[:] = rest + delta
