import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import Screen from './Screen'
import type { Lang } from '../i18n'

// Model: "mac-draco.glb" uit pmndrs/examples (floating-laptop demo).
// De mesh-structuur hieronder is gegenereerd met gltfjsx.
const MODEL_URL = '/models/mac-draco.glb'

interface MacbookProps {
  lang: Lang
  setLang: (lang: Lang) => void
  onOpenPhoto: () => void
}

export default function Macbook({ lang, setLang, onOpenPhoto }: MacbookProps) {
  const group = useRef<THREE.Group>(null!)
  // Zelf-gehoste DRACO-decoder (public/draco) i.p.v. Google CDN
  const { nodes, materials } = useGLTF(MODEL_URL, '/draco/gltf/') as unknown as {
    nodes: Record<string, THREE.Mesh>
    materials: Record<string, THREE.Material>
  }

  // Zachte zweef-animatie, overgenomen van de officiële drei-demo
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, Math.cos(t / 2) / 20 + 0.25, 0.1)
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, Math.sin(t / 4) / 20, 0.1)
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, Math.sin(t / 8) / 20, 0.1)
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, (-2 + Math.sin(t / 2)) / 2, 0.1)
  })

  return (
    <group ref={group} dispose={null}>
      {/* scherm-deel, opengeklapt */}
      <group rotation-x={-0.425} position={[0, -0.04, 0.41]}>
        <group position={[0, 2.96, -0.13]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={materials.aluminium} geometry={nodes['Cube008'].geometry} />
          <mesh material={materials['matte.001']} geometry={nodes['Cube008_1'].geometry} />
          <mesh geometry={nodes['Cube008_2'].geometry}>
            {/* Het 'beeldscherm': HTML geprojecteerd op de schermmesh.
                scale 0.5 compenseert de verdubbelde css-pixelmaten van
                .screen-content — zo rastert de tekst op 2x resolutie. */}
            <Html
              className="screen-content"
              rotation-x={-Math.PI / 2}
              position={[0, 0.05, -0.09]}
              scale={0.5}
              transform
              occlude
              zIndexRange={[10, 0]}
            >
              <div className="screen-wrapper" onPointerDown={(e) => e.stopPropagation()}>
                <Screen lang={lang} setLang={setLang} onOpenPhoto={onOpenPhoto} />
              </div>
            </Html>
          </mesh>
        </group>
      </group>

      {/* toetsenbord en onderkant */}
      <mesh material={materials.keys} geometry={nodes.keyboard.geometry} position={[1.79, 0, 3.45]} />
      <group position={[0, -0.1, 3.39]}>
        <mesh material={materials.aluminium} geometry={nodes['Cube002'].geometry} />
        <mesh material={materials.trackpad} geometry={nodes['Cube002_1'].geometry} />
      </group>
      <mesh material={materials.touchbar} geometry={nodes.touchbar.geometry} position={[0, -0.03, 1.2]} />
    </group>
  )
}

useGLTF.preload(MODEL_URL, '/draco/gltf/')
