import { API } from "../../types";

export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  htmlLink: string;
};

export type Data = {
  calendarIds: string[];
  maxResults: number;
  showUpcoming: boolean;
  showToday: boolean;
  timeRange: number; // Days to look ahead
  showDescription: boolean;
  showLocation: boolean;
  // OAuth 2.0 support
  authMethod: 'apiKey' | 'oauth';
};

export type Cache = {
  timestamp: number;
  events: CalendarEvent[];
} | undefined;

export type Props = API<Data, Cache>;

export type OAuthTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

export type CalendarList = {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: string;
};

export const defaultData: Data = {
  calendarIds: [],
  maxResults: 5,
  showUpcoming: true,
  showToday: true,
  timeRange: 7,
  showDescription: false,
  showLocation: false,
  authMethod: 'apiKey',
}; 