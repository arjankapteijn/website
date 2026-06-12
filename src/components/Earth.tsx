import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(max(0.0, 0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.5);
    gl_FragColor = vec4(0.35, 0.6, 1.0, 1.0) * intensity;
  }
`

export default function Earth() {
  const earthRef = useRef<THREE.Mesh>(null!)
  const cloudsRef = useRef<THREE.Mesh>(null!)

  const [map, normalMap, specularMap, cloudsMap] = useTexture([
    '/textures/earth_atmos_2048.jpg',
    '/textures/earth_normal_2048.jpg',
    '/textures/earth_specular_2048.jpg',
    '/textures/earth_clouds_1024.png',
  ])
  map.colorSpace = THREE.SRGBColorSpace
  cloudsMap.colorSpace = THREE.SRGBColorSpace

  useFrame((_, delta) => {
    earthRef.current.rotation.y += delta * 0.012
    cloudsRef.current.rotation.y += delta * 0.017
  })

  return (
    <group position={[10, -14, -62]}>
      <mesh ref={earthRef} rotation={[0.15, 2.2, 0.18]}>
        <sphereGeometry args={[26, 96, 96]} />
        <meshPhongMaterial
          map={map}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.85, 0.85)}
          specularMap={specularMap}
          specular={new THREE.Color('#6688cc')}
          shininess={14}
        />
      </mesh>

      {/* Wolkenlaag, draait iets sneller dan het oppervlak */}
      <mesh ref={cloudsRef} rotation={[0.15, 1.1, 0.18]}>
        <sphereGeometry args={[26.22, 96, 96]} />
        <meshLambertMaterial map={cloudsMap} transparent opacity={0.85} depthWrite={false} />
      </mesh>

      {/* Atmosferische gloed (fresnel-shader op de buitenkant) */}
      <mesh>
        <sphereGeometry args={[27.4, 64, 64]} />
        <shaderMaterial
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
