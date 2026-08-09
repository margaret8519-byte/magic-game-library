(() => {
  'use strict';
  if(window.AdventureMusic)return;

  const audio=new Audio('../assets/audio/adventure-theme.mp3');
  audio.loop=true;
  audio.preload='auto';
  audio.volume=0;

  let baseVolume=.12;
  let activated=false;
  let failed=false;
  let fadeFrame=0;
  let fadeGeneration=0;
  let boostTimer=0;
  let playPromise=null;

  const soundEnabled=()=>localStorage.getItem('magic-library-sound')!=='off';

  function fadeTo(target,duration=500,onDone){
    cancelAnimationFrame(fadeFrame);
    const generation=++fadeGeneration;
    const from=audio.volume;
    const started=performance.now();
    const step=now=>{
      if(generation!==fadeGeneration)return;
      const progress=Math.min(1,(now-started)/duration);
      audio.volume=Math.max(0,Math.min(1,from+(target-from)*progress));
      if(progress<1)fadeFrame=requestAnimationFrame(step);
      else onDone?.();
    };
    fadeFrame=requestAnimationFrame(step);
  }

  async function play(){
    activated=true;
    if(failed||!soundEnabled())return false;
    if(!audio.paused&&!audio.ended){
      if(audio.volume!==baseVolume)fadeTo(baseVolume,350);
      return true;
    }
    if(playPromise)return playPromise;
    playPromise=audio.play().then(()=>{
      fadeTo(baseVolume,1000);
      return true;
    }).catch(()=>false).finally(()=>{playPromise=null});
    return playPromise;
  }

  function pause(){
    if(audio.paused)return;
    fadeTo(0,400,()=>{
      if(!soundEnabled())audio.pause();
    });
  }

  function syncWithSoundSetting(){
    if(soundEnabled()){
      if(activated)play();
    }else pause();
  }

  function configure(volume){
    baseVolume=Math.max(0,Math.min(.2,Number(volume)||.12));
    if(!audio.paused&&soundEnabled())fadeTo(baseVolume,350);
  }

  function portalBoost(duration=3100){
    if(!soundEnabled()||audio.paused)return;
    clearTimeout(boostTimer);
    fadeTo(Math.min(.16,baseVolume+.04),300);
    boostTimer=setTimeout(()=>{
      if(soundEnabled()&&!audio.paused)fadeTo(baseVolume,600);
    },Math.max(500,duration-450));
  }

  function duck(duration=500){
    if(!soundEnabled()||audio.paused)return;
    fadeTo(Math.min(.07,baseVolume),120);
    setTimeout(()=>{
      if(soundEnabled()&&!audio.paused)fadeTo(baseVolume,350);
    },duration);
  }

  function activate(){
    if(activated)return;
    activated=true;
    removeEventListener('pointerdown',activate,true);
    removeEventListener('keydown',activate,true);
    if(soundEnabled())play();
  }

  audio.addEventListener('error',()=>{
    failed=true;
    cancelAnimationFrame(fadeFrame);
  });
  audio.addEventListener('ended',()=>{
    if(soundEnabled())play();
  });
  addEventListener('pointerdown',activate,{capture:true});
  addEventListener('keydown',activate,{capture:true});
  addEventListener('storage',event=>{
    if(event.key==='magic-library-sound')syncWithSoundSetting();
  });

  window.AdventureMusic={
    audio,play,pause,fadeIn:play,fadeOut:pause,setVolume:configure,configure,
    syncWithSoundSetting,portalBoost,duck,
    get baseVolume(){return baseVolume}
  };
})();
