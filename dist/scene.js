import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { planets } from './data.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = THREE.MathUtils.clamp;

export async function createSpace(container, {onProgress, onSelect, onContextLost}) {
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x080a0e, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); onContextLost(); });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38,1,.1,1400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .065;
  controls.enablePan = false;
  controls.rotateSpeed = .45;
  controls.zoomSpeed = .65;
  controls.minPolarAngle = .12;
  controls.maxPolarAngle = Math.PI - .12;
  const keyLight = new THREE.DirectionalLight(0xfff1de,3.4);
  keyLight.position.set(-7,5,6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048,2048);
  keyLight.shadow.camera.left=-5;keyLight.shadow.camera.right=5;
  keyLight.shadow.camera.top=5;keyLight.shadow.camera.bottom=-5;
  keyLight.shadow.camera.near=.5;keyLight.shadow.camera.far=25;
  keyLight.shadow.bias=-.0003;
  keyLight.shadow.normalBias=.015;
  scene.add(keyLight,new THREE.AmbientLight(0xa4bbdf,.17));
  const fill = new THREE.DirectionalLight(0x90a8d0,.13);
  fill.position.set(4,-2,-6);scene.add(fill);

  // Seeded star positions make the sky stable between visits.
  let seed=2617;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const starsGeometry = new THREE.BufferGeometry();
  const positions=[],colors=[];
  for(let i=0;i<1800;i++) {
    const theta=random()*Math.PI*2,cosPhi=random()*2-1;
    const sinPhi=Math.sqrt(1-cosPhi*cosPhi),radius=350+random()*300;
    positions.push(radius*sinPhi*Math.cos(theta),radius*cosPhi,radius*sinPhi*Math.sin(theta));
    const value=.25+random()*.5;
    colors.push(value*.95,value,value*1.05);
  }
  starsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  starsGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const stars = new THREE.Points(starsGeometry,new THREE.ShaderMaterial({
    vertexColors:true,transparent:true,depthWrite:false,
    vertexShader:'varying vec3 vColor; void main(){ vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=2.; gl_Position=projectionMatrix*mv; }',
    fragmentShader:'varying vec3 vColor; void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.1,.5,d);gl_FragColor=vec4(vColor,a*.9);}'
  }));
  scene.add(stars);

  const textureLoader = new THREE.TextureLoader();
  const files=[...new Set([...planets.map(p=>p.texture),'saturn_ring_alpha.png','sun.jpg','earth_clouds.jpg'])];
  let completed=0;
  const textures=Object.fromEntries(await Promise.all(files.map(async name=>{
    const texture=await textureLoader.loadAsync(`./assets/${name}`);
    texture.colorSpace=name==='earth_clouds.jpg'?THREE.NoColorSpace:THREE.SRGBColorSpace;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    onProgress(++completed/files.length);
    return [name,texture];
  })));
  const sphereGeometry = new THREE.SphereGeometry(1,96,64);
  const ringGeometry = new THREE.RingGeometry(1.28,2.32,192,2);
  const ringUV=ringGeometry.attributes.uv,ringPosition=ringGeometry.attributes.position;
  for(let i=0;i<ringUV.count;i++) {
    const r=Math.hypot(ringPosition.getX(i),ringPosition.getY(i));
    ringUV.setXY(i,(r-1.28)/(2.32-1.28),.5);
  }
  function makePlanet(planet,detail=true) {
    const group=new THREE.Group();
    const material=new THREE.MeshStandardMaterial({map:textures[planet.texture],roughness:.97,metalness:0});
    const sphere=new THREE.Mesh(sphereGeometry,material);
    sphere.castShadow=true;sphere.receiveShadow=true;sphere.rotation.y=.4;
    group.add(sphere);
    group.userData={planet:planet.id,sphere};
    if(planet.id==='saturn') {
      group.rotation.z=.38;
      const ring=new THREE.Mesh(ringGeometry,new THREE.MeshStandardMaterial({map:textures['saturn_ring_alpha.png'],side:THREE.DoubleSide,transparent:true,opacity:.96,alphaTest:.08,roughness:1,metalness:0,depthWrite:false}));
      ring.rotation.x=-Math.PI/2;
      ring.receiveShadow=true;ring.castShadow=true;
      group.add(ring);
    } else if(planet.id==='uranus') { group.rotation.z=1.7; }
    else if(planet.id==='earth') {
      group.rotation.z=.12;
      if(detail) {
        const clouds=new THREE.Mesh(sphereGeometry,new THREE.MeshStandardMaterial({alphaMap:textures['earth_clouds.jpg'],transparent:true,opacity:.45,depthWrite:false,roughness:1}));
        clouds.scale.setScalar(1.007);group.add(clouds);group.userData.clouds=clouds;
      }
    } else {group.rotation.z=.035;}
    if(detail && ['earth','venus','neptune','uranus'].includes(planet.id)) {
      const atmosphere=new THREE.Mesh(sphereGeometry,new THREE.ShaderMaterial({
        uniforms:{glowColor:{value:new THREE.Color(planet.color)}},
        vertexShader:'varying vec3 vNormal; varying vec3 vPosition;void main(){vNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vPosition=p.xyz;gl_Position=projectionMatrix*p;}',
        fragmentShader:'uniform vec3 glowColor;varying vec3 vNormal;varying vec3 vPosition;void main(){float rim=pow(1.-max(dot(normalize(vNormal),normalize(-vPosition)),0.),4.);gl_FragColor=vec4(glowColor,rim*.24);}',
        transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,
      }));
      atmosphere.scale.setScalar(1.025);group.add(atmosphere);
    }
    return group;
  }

  const focusRoot=new THREE.Group();scene.add(focusRoot);
  const focused=planets.map(planet=>{const object=makePlanet(planet);object.scale.setScalar(planet.id==='saturn'?1.45:1.75);object.visible=false;focusRoot.add(object);return object;});
  focused[5].visible=true;
  const overviewRoot=new THREE.Group();overviewRoot.visible=false;scene.add(overviewRoot);
  const sun=new THREE.Mesh(new THREE.SphereGeometry(1.45,48,32),new THREE.MeshBasicMaterial({map:textures['sun.jpg'],color:0xffe4b6}));
  overviewRoot.add(sun);
  const solarLight=new THREE.PointLight(0xffeed4,65,0,1.4);overviewRoot.add(solarLight);
  const orbitRadii=[3.3,4.8,6.4,8.1,11,14.8,18.5,22.5];
  const angles=[.25,2.3,4.6,3.25,5.75,.65,3.85,2.2];
  const overviewPlanets=planets.map((planet,index)=>{
    const object=makePlanet(planet,false);object.scale.setScalar(planet.radius*.64);
    overviewRoot.add(object);
    const points=[];
    for(let i=0;i<180;i++){const a=i/180*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*orbitRadii[index],0,Math.sin(a)*orbitRadii[index]));}
    const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x6c7b95,transparent:true,opacity:.18}));
    overviewRoot.add(line);
    return object;
  });

  let mode='explore',selected=5,playing=!reducedMotion,speed=1,transition=null,disposed=false;
  const labels=document.getElementById('orbit-labels');
  const overviewCaption=document.getElementById('overview-caption');
  const labelButtons=planets.map(planet=>{
    const button=document.createElement('button');button.className='orbit-label';button.textContent=planet.name;button.ariaLabel=`Explore ${planet.name}`;
    button.onclick=()=>onSelect(planet.id);labels.append(button);return button;
  });
  let width=1,height=1;
  function framing() {
    const aspect=width/height,mobile=width<=760;
    camera.aspect=aspect;
    if(mode==='explore') {
      camera.setViewOffset(width,height,mobile?0:width*.14,mobile?height*.19:height*.065,width,height);
      const distance=mobile?Math.max(14,10/aspect):Math.max(9.5,8/aspect);
      return new THREE.Vector3(0,distance*.29,distance);
    }
    camera.setViewOffset(width,height,0,mobile?height*.015:0,width,height);
    const distance=Math.max(78,80/aspect);
    return new THREE.Vector3(0,distance*.7,distance*.72);
  }
  function reset(animate=true) {
    const target=framing();
    controls.minDistance=mode==='explore'?4.5:12;
    controls.maxDistance=mode==='explore'?Math.max(30,target.length()*1.6):140;
    if(animate&&!reducedMotion){transition={from:camera.position.clone(),to:target,start:performance.now(),duration:1000};controls.enabled=false;}
    else {transition=null;controls.enabled=true;camera.position.copy(target);controls.target.set(0,0,0);controls.update();}
    camera.updateProjectionMatrix();
  }
  const resize=()=>{width=container.clientWidth;height=container.clientHeight;renderer.setSize(width,height);reset(false);};
  const observer=new ResizeObserver(resize);observer.observe(container);resize();

  // Render actual small 3D planets for the dock, rather than flattening the maps.
  const thumbnailRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  thumbnailRenderer.setSize(192,144);thumbnailRenderer.setPixelRatio(1);
  thumbnailRenderer.outputColorSpace=THREE.SRGBColorSpace;thumbnailRenderer.toneMapping=THREE.ACESFilmicToneMapping;
  const thumbScene=new THREE.Scene();
  thumbScene.add(new THREE.AmbientLight(0xffffff,.42));
  const thumbLight=new THREE.DirectionalLight(0xfff4e8,3);thumbLight.position.set(-3,4,6);thumbScene.add(thumbLight);
  const thumbCamera=new THREE.PerspectiveCamera(35,192/144,.1,30);
  const thumbnails=planets.map(planet=>{
    const object=makePlanet(planet,false);thumbScene.add(object);
    thumbCamera.position.set(0,planet.id==='saturn'?2:1,planet.id==='saturn'?7:4.3);thumbCamera.lookAt(0,0,0);
    thumbnailRenderer.render(thumbScene,thumbCamera);
    const url=thumbnailRenderer.domElement.toDataURL('image/png');thumbScene.remove(object);
    object.traverse(child=>{if(child.material)child.material.dispose();});return url;
  });
  thumbnailRenderer.dispose();thumbnailRenderer.forceContextLoss();

  const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();
  let down=null;
  renderer.domElement.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};});
  renderer.domElement.addEventListener('pointerup',event=>{
    if(mode!=='overview'||!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(overviewPlanets,true);
    if(hits.length){let object=hits[0].object;while(object&&!object.userData.planet)object=object.parent;if(object)onSelect(object.userData.planet);}
  });
  controls.addEventListener('start',()=>{transition=null;controls.enabled=true;});
  const projected=new THREE.Vector3();
  let last=performance.now(),frame=0;
  function render(now) {
    if(disposed)return;
    const delta=Math.min((now-last)/1000,.05);last=now;
    if(!document.hidden) {
      if(transition){const t=clamp((now-transition.start)/transition.duration,0,1),ease=1-Math.pow(1-t,3);camera.position.lerpVectors(transition.from,transition.to,ease);if(t===1){transition=null;controls.enabled=true;}}
      if(playing) {
        const planet=planets[selected];
        focused[selected].userData.sphere.rotation.y+=delta*speed*.08*(24/Math.abs(planet.rotation))*Math.sign(planet.rotation);
        if(focused[selected].userData.clouds)focused[selected].userData.clouds.rotation.y+=delta*speed*.012;
      }
      overviewPlanets.forEach((object,index)=>{
        if(playing&&mode==='overview')angles[index]+=delta*speed*.18/planets[index].period;
        object.position.set(Math.cos(angles[index])*orbitRadii[index],0,Math.sin(angles[index])*orbitRadii[index]);
        if(playing&&mode==='overview')object.userData.sphere.rotation.y+=delta*speed*.12*Math.sign(planets[index].rotation);
      });
      controls.update();
      renderer.render(scene,camera);
      if(mode==='overview') {
        // Read layout before writing transforms. Protect the entire heading block,
        // including wrapped text, as the camera, viewport, and planets move.
        const captionBounds=overviewCaption.getBoundingClientRect();
        const layerBounds=labels.getBoundingClientRect();
        const labelSizes=labelButtons.map(button=>({width:button.offsetWidth,height:button.offsetHeight}));
        const clearance=12;
        overviewPlanets.forEach((object,index)=>{
          projected.copy(object.position);projected.y+=planets[index].radius*.7;projected.project(camera);
          const x=(projected.x*.5+.5)*width;
          const y=(-projected.y*.5+.5)*height-17;
          const left=layerBounds.left+x-labelSizes[index].width/2;
          const top=layerBounds.top+y-labelSizes[index].height;
          const overlapsCaption=left<captionBounds.right+clearance
            &&left+labelSizes[index].width>captionBounds.left-clearance
            &&top<captionBounds.bottom+clearance
            &&top+labelSizes[index].height>captionBounds.top-clearance;
          const visible=projected.z>-1&&projected.z<1&&!overlapsCaption;
          labelButtons[index].style.visibility=visible?'visible':'hidden';
          labelButtons[index].style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;
        });
      }
    }
    frame=requestAnimationFrame(render);
  }
  frame=requestAnimationFrame(render);
  return {
    thumbnails,
    select(index){selected=index;mode='explore';focusRoot.visible=true;overviewRoot.visible=false;focused.forEach((object,i)=>object.visible=i===index);keyLight.intensity=3.4;fill.intensity=.13;reset();},
    overview(){mode='overview';focusRoot.visible=false;overviewRoot.visible=true;keyLight.intensity=.45;fill.intensity=.28;reset();},
    reset(){reset();},
    setPlaying(value){playing=value;},
    setSpeed(value){speed=value;},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.dispose();},
  };
}
