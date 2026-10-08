/* Rendered clay illustration: four expression frames with CSS animation. */
(function(root){
 'use strict';
 const stage=document.getElementById('cindy-portrait'),button=document.getElementById('motion-toggle'),login=document.getElementById('login-screen');
 if(!stage||!button||!login)return;
 const media=root.matchMedia('(prefers-reduced-motion: reduce)');let paused=media.matches;
 function sync(){stage.classList.toggle('portrait-paused',paused||document.hidden||login.hidden);button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'Putar animasi':'Jeda animasi');button.textContent=paused?'▷':'Ⅱ';}
 root.CindyCharacter={toggle(){paused=!paused;sync();},setPaused(value){paused=!!value;sync();}};
 media.addEventListener('change',e=>{paused=e.matches;sync();});document.addEventListener('visibilitychange',sync);new MutationObserver(sync).observe(login,{attributes:true,attributeFilter:['hidden']});sync();
})(window);
