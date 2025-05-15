import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import PowerEditor from "./pages/PowerEditor";
import { ToastContainer } from "react-toastify";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route index element={<PowerEditor />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
