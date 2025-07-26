import { Config } from "../../types";
import GoogleCalendar from "./GoogleCalendar";
import GoogleCalendarSettings from "./GoogleCalendarSettings";

const config: Config = {
  key: "widget/google-calendar",
  name: "Google Calendar",
  description: "Display events from your Google Calendar.",
  dashboardComponent: GoogleCalendar,
  settingsComponent: GoogleCalendarSettings,
};

export default config; 