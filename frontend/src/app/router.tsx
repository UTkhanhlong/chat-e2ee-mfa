import { createBrowserRouter } from 'react-router-dom'
import Layout from './Layout'
import App from '../pages/App'
import Login from '../pages/Login'
import Chat from '../pages/Chat'

const withLayout = (el: JSX.Element) => <Layout>{el}</Layout>

export const router = createBrowserRouter([
  { path: '/', element: withLayout(<App/>) },
  { path: '/login', element: withLayout(<Login/>) },
  { path: '/chat', element: withLayout(<Chat/>) },
])