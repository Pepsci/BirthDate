import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  PiggyBank,
  CalendarDays,
  ScrollText,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";
import apiHandler from "../../api/apiHandler";
import "./css/admin.css";

const AdminLayout = () => {
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    apiHandler
      .get("/admin/pools/alerts")
      .then((res) => setAlertCount(res.data.alerts?.length || 0))
      .catch(() => {});
  }, []);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>Admin</h2>
          <span className="admin-badge">BirthReminder</span>
        </div>
        <nav className="admin-nav">
          <NavLink to="/admin" end>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          <NavLink to="/admin/users">
            <Users size={18} /> Utilisateurs
          </NavLink>
          <NavLink to="/admin/pools">
            <PiggyBank size={18} /> Cagnottes
          </NavLink>
          <NavLink to="/admin/events">
            <CalendarDays size={18} /> Événements
          </NavLink>
          <NavLink to="/admin/alerts">
            <ShieldAlert size={18} /> Alertes
            {alertCount > 0 && (
              <span className="admin-nav-badge">{alertCount}</span>
            )}
          </NavLink>
          <NavLink to="/admin/logs">
            <ScrollText size={18} /> Logs
          </NavLink>
        </nav>
        <button className="admin-back-btn" onClick={() => navigate("/home")}>
          <ArrowLeft size={16} /> Retour à l'app
        </button>
      </aside>
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
