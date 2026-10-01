// Bounded GLB pilot inside Pixi's own WebGL Mesh pipe. One container per
// actor enters the existing RenderLayer; there is no overlay canvas/context.
import { Bounds, Container, Geometry, GlProgram, Mesh, RenderTexture, Shader, State, Texture, UniformGroup } from 'pixi.js';
import { decodeActor3dGlb, createActor3dPoseWorkspace, evaluateActor3dPose,
  createActor3dJointBounds, projectActor3dBounds } from './actor-3d-model.mjs';
import { createActor3dDepthRegistry, ACTOR3D_BOSS_IDS, ACTOR3D_ENEMY_IDS, ACTOR3D_HERO_WEAPON_IDS } from './actor-3d-controller.mjs';
import { heroClipProp } from './actor-3d-clips.mjs';
import { validateWeaponModelManifest, decodeWeaponGlb, createWeaponAttachment, weaponModelUrl, weaponSocketToModel, weaponModelToWorldOffset } from './weapon-model.mjs';

const vertex = `#version 300 es
precision highp float;
in vec3 aSourcePosition; in vec3 aNormal; in vec2 aUV;
in vec4 aJoints; in vec4 aWeights; in vec4 aTangent;
uniform mat4 uJoints[32];
uniform mat3 uProjectionMatrix; uniform mat3 uWorldTransformMatrix; uniform mat3 uTransformMatrix;
uniform vec4 uColor; uniform vec4 uWorldColorAlpha;
uniform vec4 uView; uniform float uDepthHalfWidth;
out vec2 vUV; out vec3 vNormal; out vec3 vTangent; out float vHandedness; out vec4 vColor;
out vec3 vPilotPosition;
void main() {
  mat4 skin = uJoints[int(aJoints.x)]*aWeights.x + uJoints[int(aJoints.y)]*aWeights.y
    + uJoints[int(aJoints.z)]*aWeights.z + uJoints[int(aJoints.w)]*aWeights.w;
  vec3 p = (skin*vec4(aSourcePosition,1.0)).xyz;
  mat3 yaw = mat3(uView.x,0.0,-uView.y, 0.0,1.0,0.0, uView.y,0.0,uView.x);
  p = yaw*p;
  // 55 degrees from vertical; Y-up prewarp cot(55), screen Y sec(55)
  // preserves the authoritative world x, ground y minus world height basis.
  float height = p.y / 1.428148007;
  vec2 local = vec2(p.x,(0.573576436*p.z-0.819152044*height)/0.573576436)*uView.z;
  vec3 projected = uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(local,1.0);
  float eye = p.z*0.819152044+height*0.573576436;
  gl_Position = vec4(projected.xy,uView.w-clamp(eye/8.0,-1.0,1.0)*uDepthHalfWidth,1.0);
  vPilotPosition=vec3(local,gl_Position.z);
  vNormal = normalize(yaw*mat3(skin)*aNormal);
  vTangent = normalize(yaw*mat3(skin)*aTangent.xyz); vHandedness=aTangent.w;
  vUV=aUV; vColor=uColor*uWorldColorAlpha;
}`;
const fragment = `#version 300 es
precision highp float;
in vec2 vUV; in vec3 vNormal; in vec3 vTangent; in float vHandedness; in vec4 vColor;
uniform sampler2D uBaseTexture; uniform sampler2D uNormalTexture; uniform sampler2D uMaterialTexture;
uniform vec4 uBaseFactor; uniform vec4 uMaterial;
out vec4 outColor;
void main() {
  vec4 base=texture(uBaseTexture,vUV)*uBaseFactor;
  if(base.a<0.5) discard;
  vec3 n=normalize(vNormal);
  if(uMaterial.z>0.5) {
    vec3 t=normalize(vTangent-n*dot(n,vTangent));
    vec3 map=texture(uNormalTexture,vUV).xyz*2.0-1.0;
    n=normalize(mat3(t,cross(n,t)*vHandedness,n)*map);
  }
  vec3 light=normalize(vec3(-0.45,0.8,0.65)); vec3 eye=normalize(vec3(0.0,0.573576436,0.819152044));
  vec2 mr=texture(uMaterialTexture,vUV).gb;
  float rough=max(0.12,mr.x*uMaterial.x), metal=clamp(mr.y*uMaterial.y,0.0,1.0);
  vec3 albedo=pow(max(base.rgb,vec3(0.0)),vec3(2.2));
  float diffuse=max(0.0,dot(n,light));
  float spec=pow(max(0.0,dot(n,normalize(light+eye))),mix(96.0,8.0,rough));
  // Broad sky/ground bounce and a camera-side fill keep faces and folds
  // readable at gameplay size, while the warm key retains directional form.
  float sky=smoothstep(-0.35,0.80,n.y);
  vec3 bounce=mix(vec3(0.42,0.38,0.34),vec3(0.63,0.67,0.72),sky);
  float fill=0.30*max(0.0,dot(n,eye));
  vec3 illumination=bounce+vec3(0.98,0.94,0.88)*(0.66*diffuse)+vec3(0.96,1.0,1.03)*fill;
  vec3 linear=albedo*illumination*(1.0-0.35*metal)+mix(vec3(0.04),albedo,metal)*spec*0.65;
  // A broad neutral edge fill separates dark clothing from soil at phone
  // scale. Use geometric normals so normal-map pores cannot sparkle; no
  // screen-space outline, extra draw, pulse or emissive texture is needed.
  float edge=pow(1.0-clamp(abs(dot(normalize(vNormal),eye)),0.0,1.0),3.0);
  linear+=vec3(0.68,0.72,0.75)*edge*(0.035+0.045*rough);
  vec3 color=pow(clamp(linear,0.0,1.0),vec3(1.0/2.2));
  float alpha=base.a*vColor.a; outColor=vec4(color*vColor.rgb*alpha,alpha);
}`;

class ActorPrimitive extends Mesh {
  get bounds() { return this.pilotBounds ?? super.bounds; }
  updateBounds() { this._bounds = this.bounds; }
}

export const actor3dNativePistol = name => name.includes('Coin Blaster') || /^(Lilly|Lit Valkyrie|Lester Original) \| coin-blaster$/.test(name);
export function actor3dPrimitiveVisible(name, clip) {
  // Which held prop a clip shows comes from the generated clip table; the nine
  // native clips resolve exactly as before (melee: knife, grenade: frag, death: none).
  const prop = heroClipProp(clip);
  if (actor3dNativePistol(name)) return prop === 'blaster';
  if ((name.includes('Litecoin Knife') || /^(Lilly|Lit Valkyrie|Lester Original) \| litecoin-knife$/.test(name))) return prop === 'knife';
  if (name.includes('Satoshi Frag') || name.includes('Throw Release Palm') || /^(Lilly|Lit Valkyrie|Lester Original) \| satoshi-frag-(held|released)$/.test(name)) return prop === 'frag';
  return true;
}

export function actor3dPrimitiveTint(name, projection) {
  const weapon = /Coin Blaster|Litecoin Knife|Satoshi Frag|Throw Release Palm/.test(name)
    || /^(Lilly|Lit Valkyrie|Lester Original) \| (coin-blaster|litecoin-knife|satoshi-frag-(held|released))$/.test(name);
  return (weapon ? projection.weaponTint : projection.bodyTint) ?? 0xffffff;
}

export async function createActor3dPixiBackend({ renderer, signal, maxActors = 24, heroActorId = 'lit-commando', fetchAsset = fetch, decodeImage = createImageBitmap } = {}) {
  const assets = new Map(), ready = new Set(), pending = new Set(), failed = new Set(), live = new Set(), order = createActor3dDepthRegistry(maxActors); let bands = new Map(), disposed = false;
  let program = null, probeTarget = null, loadQueue = Promise.resolve();
  // Seated weapon models (2.0 weapons lane): one manifest, one GLB per gun,
  // fetched on first equip through the same serial queue. A failed weapon
  // leaves the sprite hero in charge of that gun and is never retried.
  const weapons = new Map(), weaponPending = new Set(), weaponFailed = new Set(); let weaponManifest = null, heroMuzzle = null;
  const state = new State(); state.depthTest = true; state.depthMask = true; state.cullMode = 'none';
  const disposeAsset = asset => {
    if (asset.disposed) return; asset.disposed = true;
    for (const geometry of asset.geometry) geometry.destroy(true);
    for (const texture of asset.textures) texture.destroy(true);
    for (const bitmap of asset.bitmaps) bitmap.close();
  };
  const disposeWeapon = weapon => { if (weapon.disposed) return; weapon.disposed = true; weapon.texture?.destroy(true); weapon.bitmap?.close(); };
  const dropWeaponMesh = display => {
    const mesh = display.weaponMesh; if (!mesh) return;
    display.weaponMesh = null; display.weaponMeshId = null; display.weaponAttachment = null;
    display.removeChild(mesh); mesh.shader.destroy(); mesh.geometry.destroy(true); mesh.destroy();
  };
  const removeDisplay = display => {
    if (!live.delete(display)) return;
    order.remove(display.pilotId);
    if (display.pilotId === 'hero') heroMuzzle = null;
    dropWeaponMesh(display);
    for (const primitive of display.children) primitive.shader.destroy();
    display.destroy({ children: true });
  };
  const dispose = () => { if (disposed) return; disposed = true; for (const display of [...live]) removeDisplay(display); for (const asset of assets.values()) disposeAsset(asset); assets.clear(); for (const weapon of weapons.values()) disposeWeapon(weapon); weapons.clear(); order.clear(); probeTarget?.destroy(true); program?.destroy(); };
  const loadWeapon = async id => {
    signal?.throwIfAborted(); if (disposed) throw new Error('disposed weapon loader');
    if (!weaponManifest) {
      const response = await fetchAsset(weaponModelUrl('manifest.json'), { signal });
      if (!response.ok) throw new Error('weapon manifest unavailable');
      weaponManifest = validateWeaponModelManifest(await response.json());
    }
    const entry = weaponManifest.weaponFor(id); if (!entry) throw new Error('unreviewed weapon model');
    const response = await fetchAsset(weaponModelUrl(entry.file), { signal });
    if (!response.ok) throw new Error('weapon model unavailable');
    const bytes = await response.arrayBuffer(); signal?.throwIfAborted(); if (disposed) throw new Error('disposed weapon loader');
    if (bytes.byteLength !== entry.bytes) throw new Error('weapon model byte ledger drift');
    const model = decodeWeaponGlb(bytes);
    if (model.triangleCount !== entry.triangles) throw new Error('weapon model triangle ledger drift');
    const weapon = { model, entry, texture: null, bitmap: null };
    weapons.set(id, weapon);
    const bitmap = await decodeImage(new Blob([model.image.data], { type: model.image.mimeType }));
    if (disposed || signal?.aborted) { bitmap.close(); throw new Error('disposed weapon decode'); }
    weapon.bitmap = bitmap; weapon.texture = Texture.from(bitmap);
    renderer.texture.bind(weapon.texture.source, 0);
    if (renderer.gl.getError() !== renderer.gl.NO_ERROR) throw new Error('weapon texture upload failed');
  };
  const seatWeapon = (display, asset, projection) => {
    const id = projection.id === 'hero' && projection.weaponId !== 'coin-blaster' && ACTOR3D_HERO_WEAPON_IDS.includes(projection.weaponId) ? projection.weaponId : null;
    const weapon = id ? weapons.get(id) : null;
    if (!weapon?.texture) { dropWeaponMesh(display); return null; }
    if (display.weaponMeshId === id) return display.weaponMesh;
    dropWeaponMesh(display);
    const hero = weaponManifest.heroFor(projection.actorId); if (!hero) throw new Error('unreviewed weapon hero');
    const attachment = createWeaponAttachment(asset.model, weapon.model, hero);
    const geometry = new Geometry({ attributes: {
      aPosition: { buffer: new Float32Array([0, 0, 0, 0]), format: 'float32x2' },
      aSourcePosition: { buffer: attachment.positions, format: 'float32x3' }, aNormal: { buffer: attachment.normals, format: 'float32x3' },
      aUV: { buffer: attachment.uvs, format: 'float32x2' }, aJoints: { buffer: attachment.joints, format: 'float32x4' },
      aWeights: { buffer: attachment.weights, format: 'float32x4' }, aTangent: { buffer: new Float32Array(attachment.positions.length / 3 * 4), format: 'float32x4' },
    }, indexBuffer: attachment.indices });
    const shader = new Shader({ glProgram: program, resources: {
      actorUniforms: display.pilotUniforms,
      materialUniforms: new UniformGroup({
        uBaseFactor: { value: new Float32Array(weapon.model.material.baseColorFactor), type: 'vec4<f32>' },
        uMaterial: { value: new Float32Array([weapon.model.material.roughness, weapon.model.material.metallic, 0, 0]), type: 'vec4<f32>' },
      }),
      uBaseTexture: weapon.texture.source, uBaseSampler: weapon.texture.source.style,
      uNormalTexture: Texture.WHITE.source, uNormalSampler: Texture.WHITE.source.style,
      uMaterialTexture: Texture.WHITE.source, uMaterialSampler: Texture.WHITE.source.style,
    } });
    const mesh = new ActorPrimitive({ geometry, shader, state, texture: weapon.texture }); mesh.pilotBounds = new Bounds();
    display.addChild(mesh); display.weaponMesh = mesh; display.weaponMeshId = id; display.weaponAttachment = attachment;
    // The seated model draws through the proven hero program; prove this
    // geometry/texture binding the same way before the sprite hero is hidden.
    const probe = new Container();
    try {
      probe.addChild(new Mesh({ geometry, shader, state, texture: weapon.texture }));
      renderer.render({ container: probe, target: probeTarget, clear: true });
      if (renderer.gl.getError() !== renderer.gl.NO_ERROR) throw new Error('weapon mesh draw failed');
    } finally { probe.destroy({ children: true }); }
    return mesh;
  };
  const loadAsset = async id => {
      signal?.throwIfAborted(); if (disposed) throw new Error('disposed actor loader');
      const response = await fetchAsset(`/assets/generated/hmh-actor-3d-pilot/${id}.glb`, { signal });
      if (!response.ok) throw new Error('pilot asset unavailable');
      const bytes = await response.arrayBuffer(); signal?.throwIfAborted(); if (disposed) throw new Error('disposed actor loader'); const model = decodeActor3dGlb(bytes);
      const asset = { model, geometry: [], textures: [], bitmaps: [], envelopes: createActor3dJointBounds(model) };
      assets.set(id, asset);
      for (const image of model.images) {
        const bitmap = await decodeImage(new Blob([image.data], { type: image.mimeType }));
        if (disposed || signal?.aborted) { bitmap.close(); throw new Error('disposed image decode'); }
        asset.bitmaps.push(bitmap);
        signal?.throwIfAborted();
        const texture = Texture.from(bitmap); asset.textures.push(texture);
        renderer.texture.bind(texture.source, 0);
        if (renderer.gl.getError() !== renderer.gl.NO_ERROR) throw new Error('pilot texture upload failed');
      }
      for (const p of model.primitives) asset.geometry.push(new Geometry({
        attributes: {
          aPosition: { buffer: new Float32Array([0, 0, 0, 0]), format: 'float32x2' }, // bounds are per Mesh
          aSourcePosition: { buffer: p.positions, format: 'float32x3' }, aNormal: { buffer: p.normals, format: 'float32x3' },
          aUV: { buffer: p.uvs, format: 'float32x2' }, aJoints: { buffer: p.joints, format: 'float32x4' },
          aWeights: { buffer: p.weights, format: 'float32x4' }, aTangent: { buffer: p.tangents ?? new Float32Array(p.positions.length / 3 * 4), format: 'float32x4' },
        }, indexBuffer: p.indices,
      }));
      // Shader compile/link failures happen before any accepted art is hidden.
      const probe = new Shader({ glProgram: program }); renderer.shader.bind(probe, true);
      const linked = renderer.gl.getProgramParameter(renderer.gl.getParameter(renderer.gl.CURRENT_PROGRAM), renderer.gl.LINK_STATUS);
      renderer.shader.resetState(); probe.destroy(); if (!linked) throw new Error('pilot shader unavailable');
      ready.add(id);
  };
  try {
    signal?.throwIfAborted();
    program = GlProgram.from({ name: 'hmh-actor-3d-pilot', vertex, fragment });
    probeTarget = RenderTexture.create({ width: 2, height: 2, resolution: 1 });
    if (heroActorId !== null && !['lit-commando', 'lilly', 'lit-valkyrie', 'lester-original'].includes(heroActorId)) throw new Error('unreviewed hero asset');
    // Startup remains one selected hero plus the two established shared actors.
    for (const id of [heroActorId, 'bagholder-rusher', 'the-liquidator'].filter(Boolean)) await loadAsset(id);
  } catch (error) { dispose(); throw error; }
  return {
    prepareActor(id) {
      if (disposed) return false;
      if (ready.has(id)) return true;
      if ((!ACTOR3D_ENEMY_IDS.includes(id) && !ACTOR3D_BOSS_IDS.includes(id)) || pending.has(id) || failed.has(id)) return false;
      pending.add(id);
      // One decode/upload at a time. A failed optional archetype retains its
      // original sprites; it cannot retire already working hero/boss assets.
      loadQueue = loadQueue.then(async () => {
        if (!disposed) await loadAsset(id);
      }).catch(() => {
        failed.add(id);
        const asset = assets.get(id); if (asset) disposeAsset(asset);
        assets.delete(id); ready.delete(id);
      }).finally(() => pending.delete(id));
      return false;
    },
    prepareWeapon(id) {
      if (disposed || !ACTOR3D_HERO_WEAPON_IDS.includes(id)) return false;
      if (weapons.get(id)?.texture) return true;
      if (weaponPending.has(id) || weaponFailed.has(id)) return false;
      weaponPending.add(id);
      loadQueue = loadQueue.then(async () => { if (!disposed) await loadWeapon(id); }).catch(() => {
        weaponFailed.add(id); const weapon = weapons.get(id); if (weapon) disposeWeapon(weapon); weapons.delete(id);
      }).finally(() => weaponPending.delete(id));
      return false;
    },
    heroMuzzle() { return heroMuzzle; },
    createDisplay(id) { order.add(id); const display = new Container({ label: `actor-3d:${id}` }); display.pilotId = id; live.add(display); return display; },
    beginFrame(frame) { bands = order.frame(frame); },
    renderActor(display, projection) {
      if (disposed || renderer.gl.isContextLost()) throw new Error('pilot context unavailable');
      const asset = assets.get(projection.actorId); if (!asset) throw new Error('unreviewed pilot actor');
      if (!display.pilotAsset) {
        display.pilotAsset = asset; display.pilotPose = createActor3dPoseWorkspace(asset.model);
        display.pilotUniforms = new UniformGroup({
          uJoints: { value: new Float32Array(32 * 16), type: 'mat4x4<f32>', size: 32 },
          uView: { value: new Float32Array(4), type: 'vec4<f32>' }, uDepthHalfWidth: { value: 0, type: 'f32' },
        });
        for (let i = 0; i < asset.model.primitives.length; i++) {
          const p = asset.model.primitives[i], material = asset.model.materials[p.material], pbr = material?.pbrMetallicRoughness ?? {};
          const texture = info => info === undefined ? Texture.WHITE : asset.textures[asset.model.textures[info.index]?.source];
          const base = texture(pbr.baseColorTexture), normal = texture(material?.normalTexture), mr = texture(pbr.metallicRoughnessTexture);
          if (!base || !normal || !mr) throw new Error('pilot material texture unavailable');
          const shader = new Shader({ glProgram: program, resources: {
            actorUniforms: display.pilotUniforms,
            materialUniforms: new UniformGroup({
              uBaseFactor: { value: new Float32Array(pbr.baseColorFactor ?? [1, 1, 1, 1]), type: 'vec4<f32>' },
              uMaterial: { value: new Float32Array([pbr.roughnessFactor ?? 1, pbr.metallicFactor ?? 1, material?.normalTexture && p.tangents ? 1 : 0, 0]), type: 'vec4<f32>' },
            }),
            uBaseTexture: base.source, uBaseSampler: base.source.style,
            uNormalTexture: normal.source, uNormalSampler: normal.source.style,
            uMaterialTexture: mr.source, uMaterialSampler: mr.source.style,
          } });
          const mesh = new ActorPrimitive({ geometry: asset.geometry[i], shader, state, texture: base }); mesh.pilotBounds = new Bounds(); display.addChild(mesh);
        }
      }
      if (display.pilotAsset !== asset) throw new Error('pilot actor identity immutable');
      const palette = evaluateActor3dPose(asset.model, projection.clip, projection.clipTimeSeconds, display.pilotPose)[0];
      const uniforms = display.pilotUniforms.uniforms, yaw = Math.PI / 2 - projection.heading, band = bands.get(projection.id);
      uniforms.uJoints.set(palette); uniforms.uView.set([Math.cos(yaw), Math.sin(yaw), projection.pixelsPerMetre * projection.zoom, band.center]); uniforms.uDepthHalfWidth = band.halfWidth;
      display.pilotUniforms.update(); display.position.set(projection.screen.x, projection.screen.y);
      const seated = seatWeapon(display, asset, projection), scale = { heading: projection.heading, pixelsPerMetre: projection.pixelsPerMetre * projection.zoom };
      for (let i = 0; i < asset.model.primitives.length; i++) {
        const mesh = display.children[i], name = asset.model.primitives[i].nodeName;
        mesh.visible = actor3dPrimitiveVisible(name, projection.clip) && !(seated && actor3dNativePistol(name));
        mesh.tint = actor3dPrimitiveTint(name, projection);
        Object.assign(mesh.pilotBounds, projectActor3dBounds(asset.envelopes[i], palette, scale));
        mesh.onViewUpdate();
      }
      if (seated) {
        seated.visible = actor3dPrimitiveVisible('Coin Blaster', projection.clip); seated.tint = projection.weaponTint ?? 0xffffff;
        Object.assign(seated.pilotBounds, projectActor3dBounds(display.weaponAttachment.envelope, palette, scale)); seated.onViewUpdate();
      }
      if (projection.id === 'hero') {
        // Muzzle for this frame: the seated model's muzzle, or the native
        // pistol's, carried through the socket joint's evaluated world matrix.
        const hero = weaponManifest?.heroFor(projection.actorId);
        const socket = seated ? display.weaponAttachment.muzzleSocket : hero && projection.weaponId === 'coin-blaster' ? hero.nativePistolMuzzleSocket : null;
        heroMuzzle = socket
          ? weaponModelToWorldOffset(weaponSocketToModel(display.pilotPose.world[seated ? display.weaponAttachment.nodeIndex : hero.socketNodeIndex], socket), { heading: projection.heading, pixelsPerMetre: projection.pixelsPerMetre })
          : null;
      }
      if (!display.pilotDrawProven) {
        // A same-context Pixi draw exercises geometry, material and global/
        // local uniform binding before the controller hides accepted sprites.
        // The 2x2 target is fixed-size and never copied into the world scene.
        const probe = new Container();
        try {
          for (const mesh of display.children) probe.addChild(new Mesh({ geometry: mesh.geometry, shader: mesh.shader, state, texture: mesh.texture }));
          renderer.render({ container: probe, target: probeTarget, clear: true });
          if (renderer.gl.getError() !== renderer.gl.NO_ERROR) throw new Error('pilot mesh draw failed');
          display.pilotDrawProven = true;
        } finally { probe.destroy({ children: true }); }
      }
    },
    removeDisplay, dispose,
  };
}
