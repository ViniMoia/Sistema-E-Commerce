import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { canUseNextImageOptimization } from '@/lib/utils'

const source = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

describe('PERF-002/PERF-003: mídia crítica da home', () => {
  it('mantém o conteúdo no HTML e adia o vídeo decorativo', () => {
    const hero = source('components/home/HeroVideo.tsx')

    expect(hero).toContain('preload="none"')
    expect(hero).toContain('src={shouldLoadVideo ? "/videos/hero.mp4" : undefined}')
    expect(hero).toContain('VIDEO_DEFER_MS = 2000')
    expect(hero).not.toContain('gsap')
    expect(hero).not.toContain('visibility: "hidden"')
  })

  it('usa next/image com sizes responsivos no catálogo', () => {
    const home = source('components/home/HomeClient.tsx')

    expect(home).toContain('from "next/image"')
    expect(home).toContain('sizes="(max-width: 640px) 85vw')
    expect(home).not.toContain('<img')
  })

  it('só envia imagens de hosts configurados ao otimizador', () => {
    expect(canUseNextImageOptimization('/images/local.jpg')).toBe(true)
    expect(canUseNextImageOptimization('https://tenant.supabase.co/storage/product.jpg')).toBe(true)
    expect(canUseNextImageOptimization('https://untrusted.example.test/product.jpg')).toBe(false)
    expect(canUseNextImageOptimization('not-a-url')).toBe(false)
  })
})
