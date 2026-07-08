import "./index.css";
import React from "react";
import { render } from "react-dom";
import { App } from "./App";
import { initAnalytics } from "./lib/analytics";

initAnalytics();

render(<App />, document.getElementById("root"));