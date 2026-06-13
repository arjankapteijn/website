import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Line, useTexture } from '@react-three/drei'
import type { IssData } from '../hooks/useIss'

const RADIUS = 26
const EARTH_POS: [number, number, number] = [10, -14, -62]

// Richting van het Aarde-middelpunt naar de camera (voor het 'meedraaien'
// van de globe zodat het sub-ISS-punt naar de kijker wijst). De extra
// offsets schuiven het ISS-punt naar rechtsboven, zodat de zwevende
// laptop er niet vóór hangt.
const VIEW_AZIMUTH = Math.atan2(0 - EARTH_POS[0], 24 - EARTH_POS[2]) + 0.45
const VIEW_ELEVATION =
  Math.atan2(1.5 - EARTH_POS[1], Math.hypot(0 - EARTH_POS[0], 24 - EARTH_POS[2])) + 0.27

/** Zet breedte-/lengtegraad om naar een punt op de bol (three.js equirect-mapping). */
export function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

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

export default function Earth({ iss }: { iss: IssData | null }) {
  const group = useRef<THREE.Group>(null!)
  const cloudsRef = useRef<THREE.Mesh>(null!)
  const haloRef = useRef<THREE.Mesh>(null!)
  const sunRef = useRef<THREE.DirectionalLight>(null!)
  const sunTargetRef = useRef<THREE.Object3D>(null!)
  const [trail, setTrail] = useState<THREE.Vector3[]>([])

  const [map, normalMap, specularMap, cloudsMap] = useTexture([
    '/textures/earth_atmos.webp',
    '/textures/earth_normal.webp',
    '/textures/earth_specular.webp',
    '/textures/earth_clouds.webp',
  ])
  map.colorSpace = THREE.SRGBColorSpace
  cloudsMap.colorSpace = THREE.SRGBColorSpace

  // Echte zonnestand (sub-solair punt) → de dag/nacht-grens klopt met nu.
  const sunPos = iss ? latLonToVec3(iss.solar_lat, iss.solar_lon, 90) : latLonToVec3(23, 30, 90)
  const issPos = iss ? latLonToVec3(iss.latitude, iss.longitude, RADIUS + 0.5) : null

  // Richt het zonlicht op het middelpunt van de aarde (i.p.v. de scène-oorsprong)
  useEffect(() => {
    sunRef.current.target = sunTargetRef.current
  }, [])

  // Spoor van eerdere ISS-posities
  useEffect(() => {
    if (!iss) return
    setTrail((prev) => [...prev, latLonToVec3(iss.latitude, iss.longitude, RADIUS + 0.4)].slice(-120))
  }, [iss])

  // De aarde reageert alleen op het 'echte' zonlicht (laag 1), niet op de
  // sfeerverlichting van de laptop. Elke render opnieuw zodat ook later
  // toegevoegde objecten (marker, spoor) meegaan — goedkoop, ~10 objecten.
  useEffect(() => {
    group.current.traverse((o) => o.layers.set(1))
  })

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()
    // wolken driften langzaam (decoratief; wolken zijn toch weer)
    cloudsRef.current.rotation.y += delta * 0.004
    // pulserend ISS-stipje
    if (haloRef.current) {
      const s = 1 + Math.sin(t * 3) * 0.35
      haloRef.current.scale.setScalar(s)
    }
    // draai de globe zachtjes zó dat het sub-ISS-punt naar de camera wijst:
    // alsof station AK-01 naast het ISS meevliegt
    if (iss) {
      const p = latLonToVec3(iss.latitude, iss.longitude, 1)
      const targetYaw = Math.atan2(-p.x, p.z) + VIEW_AZIMUTH
      const h = Math.hypot(p.x, p.z)
      const targetPitch = Math.atan2(p.y, h) - VIEW_ELEVATION
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetYaw, 0.5, delta)
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetPitch, 0.5, delta)
    }
  })

  return (
    <group ref={group} position={EARTH_POS} rotation={[0.1, -1.66, 0]}>
      {/* echte zon: positie uit de wheretheiss.at-API */}
      <object3D ref={sunTargetRef} />
      <directionalLight ref={sunRef} position={sunPos.toArray()} intensity={3} color="#fff2dd" />

      <mesh>
        <sphereGeometry args={[RADIUS, 96, 96]} />
        <meshPhongMaterial
          map={map}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.85, 0.85)}
          specularMap={specularMap}
          specular={new THREE.Color('#6688cc')}
          shininess={14}
        />
      </mesh>

      {/* Wolkenlaag */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[RADIUS * 1.0085, 96, 96]} />
        <meshLambertMaterial map={cloudsMap} transparent opacity={0.85} depthWrite={false} />
      </mesh>

      {/* Atmosferische gloed (fresnel-shader op de buitenkant) */}
      <mesh>
        <sphereGeometry args={[RADIUS * 1.054, 64, 64]} />
        <shaderMaterial
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Live ISS-positie: stip + pulserende ring, plat op het oppervlak */}
      {issPos && (
        <group
          name="iss-marker"
          position={issPos.toArray()}
          quaternion={new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            issPos.clone().normalize(),
          )}
        >
          <mesh>
            <sphereGeometry args={[0.45, 12, 12]} />
            <meshBasicMaterial color="#b6ffbb" />
          </mesh>
          <mesh ref={haloRef}>
            <torusGeometry args={[1.15, 0.09, 8, 40]} />
            <meshBasicMaterial color="#7ee787" transparent opacity={0.75} depthWrite={false} />
          </mesh>
        </group>
      )}
      {trail.length >= 2 && (
        <Line points={trail} color="#7ee787" transparent opacity={0.45} lineWidth={2} />
      )}
    </group>
  )
}
