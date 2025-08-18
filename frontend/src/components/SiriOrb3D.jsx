import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sphere, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

// 3D Orb Component with pulsating effect
function OrbModel({ running, hovered, clicked, setClicked }) {
  const meshRef = useRef()
  
  // Handle click animation
  useEffect(() => {
    if (clicked) {
      // Reset clicked state after animation
      const timer = setTimeout(() => setClicked(false), 300)
      return () => clearTimeout(timer)
    }
  }, [clicked, setClicked])
  
  // Pulsating animation
  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating motion
      meshRef.current.position.y = Math.sin(state.clock.getElapsedTime()) * 0.05
      
      // Pulsating scale effect when running
      if (running) {
        const scale = 1 + Math.sin(state.clock.getElapsedTime() * 8) * 0.03
        meshRef.current.scale.setScalar(scale)
      } 
      // Click bounce effect
      else if (clicked) {
        const bounce = 1 + Math.sin(state.clock.getElapsedTime() * 20) * 0.1
        meshRef.current.scale.setScalar(bounce)
      } else {
        meshRef.current.scale.setScalar(1)
      }
      
      // Smooth rotation effect based on hover state
      const rotationSpeed = hovered ? 0.3 : 0.1
      meshRef.current.rotation.y += (rotationSpeed - meshRef.current.rotation.y) * 0.05
      meshRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.05
    }
  })

  // Dynamic color based on state with smooth transitions
  useFrame((state) => {
    if (meshRef.current) {
      // Smoothly interpolate colors
      const time = state.clock.getElapsedTime()
      const hoverIntensity = hovered ? 0.8 : 0.4
      const targetEmissiveIntensity = running ? 0.8 : (clicked ? 1.0 : hoverIntensity)
      
      // Apply gradual change to emissive intensity
      meshRef.current.material.emissiveIntensity += (targetEmissiveIntensity - meshRef.current.material.emissiveIntensity) * 0.05
      
      // Change color when clicked
      if (clicked) {
        // Cycle through colors when clicked
        const hue = (time * 50) % 360
        const color = new THREE.Color(`hsl(${hue}, 80%, 60%)`)
        meshRef.current.material.emissive = color
      } else if (running) {
        meshRef.current.material.emissive = new THREE.Color("#c084fc")
      } else {
        meshRef.current.material.emissive = new THREE.Color("#818cf8")
      }
    }
  })

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]} position={[0, 0, 0]}>
      <MeshDistortMaterial
        color="#6366f1"
        emissive="#818cf8"
        emissiveIntensity={0.4}
        distort={0.3}
        speed={2}
        roughness={0.1}
        metalness={0.9}
      />
    </Sphere>
  )
}

// Floating particles around the orb
function FloatingParticles({ running, hovered, clicked }) {
  const particlesRef = useRef()
  
  // Create particles with initial positions
  const particleData = React.useMemo(() => {
    const particleCount = 50
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ),
      speed: Math.random() * 0.5 + 0.1,
      size: Math.random() * 0.05 + 0.02,
      distance: Math.random() * 2 + 1, // Current distance
      originalDistance: Math.random() * 2 + 1, // Base distance
      opacity: 0.6 // Current opacity
    }))
  }, [])
  
  useFrame((state) => {
    if (particlesRef.current) {
      // Smoothly interpolate rotation speed based on hover state
      const targetRotationSpeedY = 0.001 * (hovered ? 2 : 1) * (clicked ? 3 : 1)
      const targetRotationSpeedX = 0.0005 * (hovered ? 2 : 1) * (clicked ? 3 : 1)
      
      // Apply smooth rotation to the particle system
      particlesRef.current.rotation.y += (targetRotationSpeedY - particlesRef.current.rotation.y * 0.1) * 0.1
      particlesRef.current.rotation.x += (targetRotationSpeedX - particlesRef.current.rotation.x * 0.1) * 0.1
      
      // Update individual particle positions with smooth transitions
      particlesRef.current.children.forEach((particle, i) => {
        if (particle && particleData[i]) {
          const data = particleData[i]
          
          // Smoothly interpolate particle speed based on hover/click state
          const baseSpeed = data.speed
          const targetSpeed = baseSpeed * (hovered ? 2 : 1) * (clicked ? 3 : 1)
          const currentSpeed = data.speed + (targetSpeed - data.speed) * 0.05
          
          // Smoothly interpolate distance based on running/clicked state
          const targetDistance = clicked ? data.originalDistance * 2 : (running ? data.originalDistance * 1.5 : data.originalDistance)
          data.distance += (targetDistance - data.distance) * 0.05
          
          // Calculate new position with smooth angle progression
          const time = state.clock.getElapsedTime()
          const angle = time * currentSpeed
          
          // Calculate new position in a circular path
          const x = Math.sin(angle + i) * data.distance
          const y = Math.cos(angle * 0.7 + i) * data.distance * 0.5
          const z = Math.cos(angle + i) * data.distance
          
          // Apply smooth position transition
          particle.position.x += (x - particle.position.x) * 0.1
          particle.position.y += (y - particle.position.y) * 0.1
          particle.position.z += (z - particle.position.z) * 0.1
          
          // When running or clicked, add extra movement with smooth transitions
          if (running || clicked) {
            const extraX = Math.sin(time * 5 + i) * 0.1 * (clicked ? 2 : 1)
            const extraY = Math.cos(time * 3 + i) * 0.1 * (clicked ? 2 : 1)
            particle.position.x += (extraX - (particle.position.x - x)) * 0.05
            particle.position.y += (extraY - (particle.position.y - y)) * 0.05
          }
          
          // Smoothly adjust opacity based on hover, running, and clicked states
          const targetOpacity = clicked ? 1.0 : (hovered ? 0.9 : (running ? 0.7 : 0.6))
          data.opacity += (targetOpacity - data.opacity) * 0.1
          
          if (particle.material) {
            particle.material.opacity = data.opacity
          }
        }
      })
    }
  })
  
  return (
    <group ref={particlesRef}>
      {particleData.map((data, i) => (
        <mesh 
          key={data.id} 
          position={[data.position.x, data.position.y, data.position.z]}
        >
          <sphereGeometry args={[data.size, 8, 8]} />
          <meshBasicMaterial 
            color={clicked ? "#f472b6" : "#818cf8"} 
            transparent 
            opacity={data.opacity} 
          />
        </mesh>
      ))}
    </group>
  )
}

// Main component
export default function SiriOrb3D({ onClick, running }) {
  const [hovered, setHovered] = useState(false)
  const [clicked, setClicked] = useState(false)
  const groupRef = useRef()

  const handleClick = (e) => {
    console.log("Orb clicked!")
    setClicked(true)
    // Call the original onClick handler
    onClick && onClick(e)
  }

  return (
    <div 
      className="relative w-[360px] h-[360px] mx-auto my-6"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Glowing background effect with smooth transition */}
      <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 ease-in-out ${
        running 
          ? 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-500 opacity-40' 
          : clicked 
            ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 opacity-60' 
            : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 opacity-30'
      }`}></div>
      
      {/* 3D Canvas */}
      <div className="absolute inset-0 rounded-full overflow-hidden">
        <Canvas
          camera={{ position: [0, 0, 3], fov: 50 }}
          className="w-full h-full"
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1.5} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#c084fc" />
          
          <OrbModel running={running} hovered={hovered} clicked={clicked} setClicked={setClicked} />
          <FloatingParticles running={running} hovered={hovered} clicked={clicked} />
          
          <OrbitControls 
            enableZoom={false} 
            enablePan={false} 
            enableRotate={true}
            autoRotate={!hovered && !running && !clicked}
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </div>
      
      {/* Click capture overlay */}
      <div 
        className="absolute inset-0 rounded-full cursor-pointer z-10"
        onClick={handleClick}
      ></div>
      
      {/* Reflective overlay for glass-like effect */}
      <div className="absolute inset-0 rounded-full pointer-events-none">
        <div className="absolute top-[20%] left-[25%] w-[30%] h-[30%] rounded-full bg-white/30 blur-xl transition-all duration-700 ease-in-out"></div>
        <div className="absolute top-[15%] left-[20%] w-[15%] h-[15%] rounded-full bg-white/50 blur-lg transition-all duration-700 ease-in-out"></div>
      </div>
      
      {/* Outer ring pulse effect when running or clicked */}
      {(running || clicked) && (
        <>
          <div className={`absolute inset-0 rounded-full border-2 ${
            clicked ? 'border-pink-400/50' : 'border-fuchsia-400/30'
          } animate-ping transition-all duration-700 ease-in-out`}></div>
          <div className={`absolute inset-0 rounded-full border ${
            clicked ? 'border-pink-400/30' : 'border-fuchsia-400/20'
          } transition-all duration-700 ease-in-out`}></div>
        </>
      )}
      
      {/* Click capture overlay */}
      <div 
        className="absolute inset-0 rounded-full cursor-pointer z-10"
        onClick={handleClick}
      ></div>
    </div>
  )
}