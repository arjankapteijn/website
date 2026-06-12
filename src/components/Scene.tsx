import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { Environment, OrbitControls, Stars } from '@react-three/drei'
import Earth from './Earth'
import SpaceStation from './SpaceStation'
import Macbook from './Macbook'
import type { Lang } from '../i18n'
import type { IssData } from '../hooks/useIss'

interface SceneProps {
  lang: Lang
  setLang: (lang: Lang) => void
  onOpenPhoto: () => void
  iss: IssData | null
}

export default function Scene({ lang, setLang, onOpenPhoto, iss }: SceneProps) {
  const camera = useThree((s) => s.camera)
  const ambientRef = useRef<THREE.AmbientLight>(null!)

  // Laag 1 = de aarde + haar eigen 'echte' zonlicht (zie Earth.tsx).
  // De camera moet die laag ook renderen; de ambient geeft de nachtzijde
  // een klein beetje vulling.
  useEffect(() => {
    camera.layers.enable(1)
  }, [camera])
  useEffect(() => {
    ambientRef.current.layers.enable(1)
  }, [])

  return (
    <>
      {/* Sfeerlicht voor de laptop en het station (laag 0) */}
      <directionalLight position={[-40, 18, 10]} intensity={2.4} color="#fff4e0" />
      {/* Blauwe 'earthshine' vanaf de aarde */}
      <pointLight position={[6, -10, -30]} intensity={120} color="#3a6fd8" />
      {/* Zachte vulling — schijnt ook op de nachtzijde van de aarde */}
      <ambientLight ref={ambientRef} intensity={0.25} color="#9db4e8" />

      <Stars radius={120} depth={60} count={6000} factor={4} saturation={0} fade speed={0.4} />

      <Earth iss={iss} />
      <SpaceStation />

      <group position={[0, 0.5, 0]}>
        <Macbook lang={lang} setLang={setLang} onOpenPhoto={onOpenPhoto} />
      </group>

      {/* Lokale HDR voor realistische reflecties in het aluminium */}
      <Environment files="/textures/potsdamer_platz_1k.hdr" />

      <OrbitControls
        target={[0, 0, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={10}
        maxDistance={34}
        minPolarAngle={Math.PI / 3.2}
        maxPolarAngle={Math.PI / 1.7}
        minAzimuthAngle={-1.1}
        maxAzimuthAngle={1.1}
      />
    </>
  )
}
