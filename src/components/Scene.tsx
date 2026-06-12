import { Environment, OrbitControls, Stars } from '@react-three/drei'
import Earth from './Earth'
import SpaceStation from './SpaceStation'
import Macbook from './Macbook'
import type { Lang } from '../i18n'

interface SceneProps {
  lang: Lang
  setLang: (lang: Lang) => void
  onOpenPhoto: () => void
}

export default function Scene({ lang, setLang, onOpenPhoto }: SceneProps) {
  return (
    <>
      {/* Zonlicht: hard wit licht van opzij voor een mooie dag/nacht-grens op de aarde */}
      <directionalLight position={[-40, 18, 10]} intensity={2.4} color="#fff4e0" />
      {/* Blauwe 'earthshine' vanaf de aarde */}
      <pointLight position={[6, -10, -30]} intensity={120} color="#3a6fd8" />
      {/* Zachte vulling zodat de laptop nooit volledig zwart is */}
      <ambientLight intensity={0.25} color="#9db4e8" />

      <Stars radius={120} depth={60} count={6000} factor={4} saturation={0} fade speed={0.4} />

      <Earth />
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
