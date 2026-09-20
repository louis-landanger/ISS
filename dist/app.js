import { planets } from './data.js';
import { createSpace } from './scene.js';

const $=id=>document.getElementById(id);
const state={selected:5,view:'explore',playing:!matchMedia('(prefers-reduced-motion: reduce)').matches,speed:1,hidden:false};
let space;
const dockButtons=planets.map((planet,index)=>{
  const button=document.createElement('button');button.className='planet-button';button.dataset.planet=planet.id;
  button.setAttribute('aria-pressed',String(index===5));button.setAttribute('aria-label',`Explore ${planet.name}`);
  const img=document.createElement('img');img.alt='';img.width=64;img.height=57;
  const label=document.createElement('span');label.textContent=planet.name;
  button.append(img,label);button.addEventListener('click',()=>selectPlanet(index));$('planet-dock').append(button);return button;
});
function stat(id,[value,unit]) {$(id).replaceChildren(document.createTextNode(`${value} `),Object.assign(document.createElement('small'),{textContent:unit}));}
function updateMode() {
  const overview=state.view==='overview';$('app').dataset.view=state.view;
  $('planet-card').hidden=overview;$('overview-caption').hidden=!overview;$('orbit-labels').hidden=!overview;
  document.querySelector('.scene-heading').hidden=overview;
  $('explore-view').classList.toggle('selected',!overview);$('explore-view').setAttribute('aria-pressed',String(!overview));
  $('overview-view').classList.toggle('selected',overview);$('overview-view').setAttribute('aria-pressed',String(overview));
}
function selectPlanet(index,moveCamera=true) {
  if(!Number.isInteger(index)||index<0||index>=planets.length)throw new Error('Unknown planet');
  state.selected=index;state.view='explore';
  const planet=planets[index];
  $('planet-name').textContent=planet.name;$('planet-type').textContent=planet.type.toUpperCase();
  $('planet-index').textContent=`${String(index+1).padStart(2,'0')} / 08`;
  $('planet-tagline').textContent=planet.tagline;$('planet-description').textContent=planet.description;
  stat('stat-diameter',[planet.diameter,'km']);stat('stat-day',planet.day);stat('stat-year',planet.year);stat('stat-distance',planet.distance);
  $('distance-marker').style.left=`${Math.min(99,planet.au/30.07*100)}%`;
  $('nasa-link').href=`https://science.nasa.gov/${planet.id}/`;
  $('space').setAttribute('aria-label',`Interactive 3D view of ${planet.name}`);
  document.documentElement.style.setProperty('--accent',planet.accent);
  dockButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  updateMode();
  if(space&&moveCamera)space.select(index);
  dockButtons[index].scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest',inline:'nearest'});
  $('announcement').textContent=`Exploring ${planet.name}. ${planet.tagline}`;
}
function showOverview(){state.view='overview';updateMode();space?.overview();$('space').setAttribute('aria-label','Interactive 3D solar system overview');$('announcement').textContent='Solar system overview. Select a planet to explore.';}
function setPlaying(value){state.playing=value;space?.setPlaying(value);$('pause-icon').toggleAttribute('hidden',!value);$('play-icon').toggleAttribute('hidden',value);$('play-pause').setAttribute('aria-label',value?'Pause animation':'Play animation');$('play-pause').title=value?'Pause animation (Space)':'Play animation (Space)';}
function toggleInterface(){state.hidden=!state.hidden;$('app').classList.toggle('ui-hidden',state.hidden);$('show-ui').hidden=!state.hidden;if(state.hidden)$('show-ui').focus();else $('hide-ui').focus();}
$('explore-view').onclick=()=>selectPlanet(state.selected);$('overview-view').onclick=showOverview;
$('reset-view').onclick=()=>space?.reset();$('play-pause').onclick=()=>setPlaying(!state.playing);
$('speed').onchange=event=>{state.speed=Number(event.target.value);space?.setSpeed(state.speed);};
$('hide-ui').onclick=toggleInterface;$('show-ui').onclick=toggleInterface;
$('about-open').onclick=()=>$('about-dialog').showModal();$('about-close').onclick=()=>$('about-dialog').close();
$('about-dialog').addEventListener('click',event=>{if(event.target===$('about-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}});
document.addEventListener('keydown',event=>{
  if($('about-dialog').open||['INPUT','SELECT','TEXTAREA','BUTTON','A'].includes(document.activeElement.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.code==='Space'){event.preventDefault();setPlaying(!state.playing);}
  if(event.code==='ArrowRight'){event.preventDefault();selectPlanet((state.selected+1)%8);}
  if(event.code==='ArrowLeft'){event.preventDefault();selectPlanet((state.selected+7)%8);}
  if(event.key.toLowerCase()==='r')space?.reset();
  if(event.key.toLowerCase()==='h')toggleInterface();
});
// H remains available while the restore button owns focus.
$('show-ui').addEventListener('keydown',event=>{if(event.key.toLowerCase()==='h'){event.preventDefault();toggleInterface();}});
function showFailure(message){
  $('loading').hidden=true;
  let fallback=$('render-fallback');
  if(!fallback){fallback=document.createElement('div');fallback.id='render-fallback';fallback.className='fallback glass';fallback.setAttribute('role','alert');$('app').append(fallback);}
  fallback.replaceChildren(Object.assign(document.createElement('p'),{textContent:message}));
  const reload=document.createElement('button');reload.textContent='Try again';reload.onclick=()=>location.reload();fallback.append(reload);
}
setPlaying(state.playing);
try {
  space=await createSpace($('space'),{onProgress:fraction=>{$('load-percent').textContent=` · ${Math.round(fraction*100)}%`;},onSelect:id=>selectPlanet(planets.findIndex(p=>p.id===id)),onContextLost:()=>showFailure('The 3D view was interrupted. Reload to return to the planets.')});
  space.thumbnails.forEach((url,index)=>dockButtons[index].querySelector('img').src=url);
  $('loading').hidden=true;
  if(state.view==='overview')space.overview();else selectPlanet(state.selected,state.selected!==5);
  space.setPlaying(state.playing);space.setSpeed(state.speed);
  // Optional browser-native agent tools use the same actions as the interface.
  const context=document.modelContext;
  if(context?.registerTool){
    const lifecycle=new AbortController();
    const tools=[
      {name:'explore_planet',description:'Select a planet and show its 3D view and facts.',inputSchema:{type:'object',properties:{planet:{type:'string',enum:planets.map(p=>p.id)}},required:['planet'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{const index=planets.findIndex(p=>p.id===input?.planet);if(index<0||Object.keys(input).some(k=>k!=='planet'))throw new Error('Choose one of the eight planet IDs.');selectPlanet(index);return {planet:planets[index].name,view:state.view};}},
      {name:'show_solar_system',description:'Navigate to the full solar system overview.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{if(!input||Object.keys(input).length)throw new Error('No arguments expected.');showOverview();return {view:state.view};}}
    ];
    for(const tool of tools){try{await context.registerTool(tool,{signal:lifecycle.signal});}catch(error){console.info('Optional agent tool unavailable:',error.message);}}
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
} catch(error){console.error('Orbit could not initialize:',error);showFailure('The 3D view couldn’t load. Check your connection and make sure WebGL is enabled in your browser.');}
