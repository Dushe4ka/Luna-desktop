import OrbView from './components/OrbView'
import PanelView from './components/PanelView'

/** Один бандл, два окна: значок и панель. Вид выбирается параметром ?view=. */
export default function App() {
  const view = new URLSearchParams(window.location.search).get('view')
  return view === 'panel' ? <PanelView /> : <OrbView />
}
