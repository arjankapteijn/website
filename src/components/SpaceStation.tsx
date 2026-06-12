import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

const hull = new THREE.MeshStandardMaterial({ color: '#b8bec9', metalness: 0.85, roughness: 0.35 })
const dark = new THREE.MeshStandardMaterial({ color: '#3a414f', metalness: 0.7, roughness: 0.5 })
const panel = new THREE.MeshStandardMaterial({
  color: '#16245e',
  metalness: 0.6,
  roughness: 0.25,
  emissive: '#0a1440',
  emissiveIntensity: 0.6,
  side: THREE.DoubleSide,
})
const windowGlow = new THREE.MeshBasicMaterial({ color: '#ffd98a' })

function SolarWing({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      {/* draagarm */}
      <mesh material={dark} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, Math.abs(x) * 0.9, 8]} />
      </mesh>
      <mesh material={panel} position={[0, 0, 1.1]}>
        <boxGeometry args={[Math.abs(x) * 1.7, 0.04, 1.9]} />
      </mesh>
      <mesh material={panel} position={[0, 0, -1.1]}>
        <boxGeometry args={[Math.abs(x) * 1.7, 0.04, 1.9]} />
      </mesh>
    </group>
  )
}

export default function SpaceStation() {
  const group = useRef<THREE.Group>(null!)
  const ring = useRef<THREE.Group>(null!)
  const beacon = useRef<THREE.Mesh>(null!)

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()
    // langzame eigen rotatie + lichte orbitale drift
    group.current.rotation.y += delta * 0.04
    group.current.position.y = -0.2 + Math.sin(t * 0.15) * 0.8
    ring.current.rotation.x += delta * 0.1
    // knipperend bakenlicht
    const m = beacon.current.material as THREE.MeshBasicMaterial
    m.opacity = 0.35 + Math.abs(Math.sin(t * 2.4)) * 0.65
  })

  return (
    <group ref={group} position={[-24, -0.2, -40]} rotation={[0.1, 0.6, -0.08]} scale={1.3}>
      {/* centrale romp */}
      <mesh material={hull} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 5.2, 24]} />
      </mesh>
      <mesh material={dark} position={[2.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.55, 0.8, 24]} />
      </mesh>
      {/* koppelmodule met venstertjes */}
      <mesh material={hull} position={[-2.9, 0, 0]}>
        <sphereGeometry args={[0.75, 24, 24]} />
      </mesh>
      {[-0.2, 0.2].map((z) => (
        <mesh key={z} material={windowGlow} position={[-3.55, 0.1, z]}>
          <boxGeometry args={[0.06, 0.14, 0.14]} />
        </mesh>
      ))}

      {/* draaiende habitat-ring */}
      <group ref={ring}>
        <mesh material={hull} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[2.6, 0.28, 16, 64]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            material={dark}
            rotation={[(i * Math.PI) / 2 + Math.PI / 4, 0, 0]}
          >
            <cylinderGeometry args={[0.09, 0.09, 5.2, 8]} />
          </mesh>
        ))}
      </group>

      {/* zonnepanelen */}
      <SolarWing x={4.6} />
      <SolarWing x={-4.6} />

      {/* knipperend baken */}
      <mesh ref={beacon} position={[3.1, 0, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial color="#ff4444" transparent />
      </mesh>
    </group>
  )
}
