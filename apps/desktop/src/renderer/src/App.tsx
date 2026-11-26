import OrbView from './components/OrbView'
import PanelView from './components/PanelView'
import MainWindow from './components/MainWindow'

/** Один бандл, два окна: значок и панель. Вид выбирается параметром ?view=. */
export default function App() {
  const view = new URLSearchParams(window.location.search).get('view')
  if (view === 'main') return <MainWindow />
  return view === 'panel' ? <PanelView /> : <OrbView />
}
