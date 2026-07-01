import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import QuickExit from './components/QuickExit';
import CheckInBanner from './components/CheckInBanner';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import SosCenter from './pages/SosCenter';
import WalkWithMe from './pages/WalkWithMe';
import PoliceStations from './pages/PoliceStations';
import Settings from './pages/Settings';
import Notes from './pages/Notes';

function Shell({ children }) {
  return (
    <>
      <CheckInBanner />
      <Navbar />
      <main>{children}</main>
      <Footer />
      <QuickExit />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/notes" element={<Notes />} />
          <Route path="/" element={<Shell><Home /></Shell>} />
          <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />
          <Route path="/contacts" element={<Shell><Contacts /></Shell>} />
          <Route path="/sos" element={<Shell><SosCenter /></Shell>} />
          <Route path="/walk-with-me" element={<Shell><WalkWithMe /></Shell>} />
          <Route path="/police-stations" element={<Shell><PoliceStations /></Shell>} />
          <Route path="/settings" element={<Shell><Settings /></Shell>} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
