function dock(area,bounds){return {x:Math.max(area.x,area.x+area.width-bounds.width-24),y:Math.max(area.y,area.y+area.height-bounds.height-12)};}
function settle(y,floor,dt){const next=y+(floor-y)*(1-Math.exp(-10*Math.min(.1,Math.max(0,dt))));return Math.abs(next-floor)<.5?floor:next;}
module.exports={dock,settle};
