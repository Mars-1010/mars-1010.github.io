const recordings={
 balanced:{number:'01 / BALANCED',title:'Stay alongside.<br>Step in when needed.',description:'A middle setting for following distance, movement speed and support frequency.'},
 calm:{number:'02 / CALM',title:'Leave more space.<br>Intervene less often.',description:'A slower, more distant companion with less frequent firing and a longer protection cooldown.'},
 aggressive:{number:'03 / AGGRESSIVE',title:'Stay close.<br>Offer more support.',description:'A faster companion that follows more closely and can intervene and fire more frequently.'},
 solo:{number:'04 / SOLO',title:'The player.<br>Without a Fellow.',description:'A recording of the game without the on-screen companion, providing a visual reference for solo play.'}
};
const player=document.querySelector('#condition-film');
const videos=[...document.querySelectorAll('video')];
// A deliberate play action is required. Only one recording plays at a time.
for(const video of videos){video.addEventListener('play',()=>{for(const other of videos)if(other!==video)other.pause();});}
for(const button of document.querySelectorAll('[data-clip]'))button.addEventListener('click',()=>{
 const key=button.dataset.clip,recording=recordings[key];if(!recording)return;
 player.pause();
 player.poster=`assets/game-fellow/${key}-poster.jpg`;
 player.querySelector('source').src=`assets/game-fellow/${key}.mp4`;
 player.setAttribute('aria-label',`${key.charAt(0).toUpperCase()+key.slice(1)}${key==='solo'?'':' companion'} development recording`);
 player.load();
 document.querySelector('#condition-number').textContent=recording.number;
 document.querySelector('#condition-title').innerHTML=recording.title;
 document.querySelector('#condition-description').textContent=recording.description;
 for(const item of document.querySelectorAll('[data-clip]')){const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const video of videos)video.pause();});
