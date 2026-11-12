(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PetModelClock=api;})(globalThis,function(){
 'use strict';
 function advance(model,seconds){
  const ms=Math.max(0,Math.min(.06,seconds||0))*1000;
  if(!model?.internalModel||!ms)return;
  // Update once before rendering, including while hidden. Pixi's render-only
  // update otherwise accumulates minutes of physics time on an invisible pet.
  model.update(ms);model.internalModel.update(ms,model.elapsedTime);model.deltaTime=0;
 }
 return {advance};
});
