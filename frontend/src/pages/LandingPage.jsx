import React from "react";
import "../App.css";
import { Link, useNavigate } from "react-router-dom";

const LandingPage = () => {
  const router = useNavigate();

  return (
    <>
      <div className="landingPageContainer">
        <nav>
          <div className="navHeader">
            <h2>VisionConnect</h2>
          </div>
          <div className="navList">
            <p
              onClick={() => {
                router("/sdc344");
              }}
            >
              Join as Guest
            </p>
            <p
              onClick={() => {
                router("/auth");
              }}
            >
              Registar
            </p>
            <div
              onClick={() => {
                router("/auth");
              }}
              role="button"
            >
              <p>Login</p>
            </div>
          </div>
        </nav>

        <div className="landingMainContainer">
          <div>
            <h2>
              <span style={{ color: "#FF9839" }}>Stay Close</span>, No Matter
              the Distance
            </h2>
            <p>Bridge the gap with effortless video calls.</p>
            <div role="button">
              <Link to={"/home"}>Join Now</Link>
            </div>
          </div>
          <div>
            <img src="/mobile.png" alt="Video call illustration" />
          </div>
        </div>
      </div>
    </>
  );
};

export default LandingPage;
