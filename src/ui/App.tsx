import { useEffect } from 'react'
import { useGame } from '../store/gameStore'
import { GameScreen } from './layout/GameScreen'
import { MenuScreen } from './screens/MenuScreen'
import { TutorialModal } from './screens/TutorialModal'

export function App() {
  const screen = useGame((s) => s.screen)
  const tutorial = useGame((s) => s.tutorial)
  const lang = useGame((s) => s.lang)
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'
    document.title = lang === 'zh' ? '韭菜反擊戰' : 'Leek Strikes Back'
  }, [lang])
  return (
    <>
      {screen === 'menu' ? <MenuScreen /> : <GameScreen />}
      {tutorial && <TutorialModal />}
    </>
  )
}
