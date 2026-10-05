"use client";

import { useState } from "react";

export type WeatherData = {
  location: string;
  country: string;
  temperatureC: number;
  feelsLikeC: number;
  humidity: number;
  windKmh: number;
  description: string;
  icon: string;
  todayForecast: {
    time: string;
    temperatureC: number;
    description: string;
    icon: string;
    rainChance: number;
  }[];
  fetchedAt: string;
};

type WeatherWidgetProps = {
  onWeatherLoaded: (weather: WeatherData) => void;
};

function formatForecastTime(time: string) {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;

  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${period}`;
}

export default function WeatherWidget({ onWeatherLoaded }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadWeather = () => {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }

    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const params = new URLSearchParams({
            lat: String(coords.latitude),
            lon: String(coords.longitude),
          });
          const response = await fetch(`/api/weather?${params}`, { cache: "no-store" });
          const data: unknown = await response.json().catch(() => null);

          if (!response.ok) {
            const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
              ? data.error
              : "Weather could not be loaded. Please try again.";
            throw new Error(message);
          }

          const loadedWeather = {
            ...(data as Omit<WeatherData, "fetchedAt">),
            fetchedAt: new Date().toISOString(),
          };
          setWeather(loadedWeather);
          onWeatherLoaded(loadedWeather);
        } catch (requestError) {
          setError(requestError instanceof Error ? requestError.message : "Weather could not be loaded.");
        } finally {
          setLoading(false);
        }
      },
      (locationError) => {
        const message = locationError.code === locationError.PERMISSION_DENIED
          ? "Allow location access in your browser to see local weather."
          : locationError.code === locationError.TIMEOUT
            ? "Finding your location took too long. Please try again."
            : "Your location is unavailable. Check that location services are on.";
        setError(message);
        setLoading(false);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 12000 },
    );
  };

  return (
    <section className="field-weather" aria-labelledby="field-weather-title">
      <div className="field-weather-heading">
        <div className="field-weather-label">
          <span>LOCAL WEATHER</span>
          <span className="field-weather-live"><span aria-hidden="true" />LIVE</span>
        </div>
        {weather && (
          <button className="field-weather-refresh" type="button" onClick={loadWeather} disabled={loading} aria-label="Refresh local weather" title="Refresh weather">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5m10-1a7 7 0 0 0-12.2-4.6L4 9m16 6-2.8 2.6A7 7 0 0 1 5 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>

      {weather ? (
        <>
          <div className="field-weather-snapshot">
            <div className="field-weather-place">
              <p className="field-weather-now">RIGHT NOW</p>
              <h2 id="field-weather-title">
                {weather.location}{weather.country ? `, ${weather.country}` : ""}
              </h2>
              <p className="field-weather-description">{weather.description}</p>
              <p className="field-weather-feels">Feels like {weather.feelsLikeC}°C</p>
            </div>
            <div className="field-weather-reading">
              <img
                src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                alt=""
                width="88"
                height="88"
              />
              <p className="field-weather-temperature">{weather.temperatureC}<span>°</span></p>
            </div>
          </div>
          <div className="field-weather-metrics" aria-label="Current field conditions">
            <div className="field-weather-metric">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" stroke="currentColor" strokeWidth="1.7"/><path d="M9 15a3 3 0 0 0 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              <span>Humidity</span><strong>{weather.humidity}%</strong>
            </div>
            <div className="field-weather-metric">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 8h12a3 3 0 1 0-3-3M2 12h16a3 3 0 1 1-3 3M4 16h6a3 3 0 1 1-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              <span>Wind</span><strong>{weather.windKmh} km/h</strong>
            </div>
            <div className="field-weather-metric">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 12v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              <span>Feels like</span><strong>{weather.feelsLikeC}°C</strong>
            </div>
          </div>
          <div className="field-forecast">
            <div className="field-forecast-heading">
              <div><h3>Rest of today</h3><p>Plan ahead by the hour</p></div>
              <span className="field-forecast-cadence">3-HOUR FORECAST</span>
            </div>
            {weather.todayForecast.length > 0 ? (
              <ol className="field-forecast-strip" aria-label="Weather forecast for the rest of today">
                {weather.todayForecast.map((period) => (
                  <li
                    className="field-forecast-period"
                    key={period.time}
                    aria-label={`${formatForecastTime(period.time)}, ${period.description}, ${period.temperatureC} degrees, ${period.rainChance}% chance of rain`}
                  >
                    <time dateTime={period.time}>{formatForecastTime(period.time)}</time>
                    <img
                      src={`https://openweathermap.org/img/wn/${period.icon}.png`}
                      alt=""
                      width="36"
                      height="36"
                    />
                    <strong>{period.temperatureC}°</strong>
                    <div className="field-forecast-rain">
                      <span><strong>{period.rainChance}%</strong> chance of rain</span>
                      <div className="field-forecast-rain-track" aria-hidden="true">
                        <span style={{ width: `${period.rainChance}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="field-forecast-empty">No more forecast periods are available for today.</p>
            )}
          </div>
        </>
      ) : (
        <div className="field-weather-empty">
          <div className="field-weather-empty-main">
            <span className="field-weather-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 40 40" fill="none"><path d="M20 4.5v4m0 23v4m15.5-15.5h-4m-23 0h-4m26.5-11.5-2.8 2.8m-16.4 16.4L9 30.5m22-1.4-2.8-2.8M11.8 10 9 7.2M27 17.5a7 7 0 1 0-9.7 9.7l2.7 3.3 2.7-3.3a7 7 0 0 0 4.3-9.7Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><circle cx="20" cy="19" r="2" fill="currentColor"/></svg>
            </span>
            <div>
              <h2 id="field-weather-title">Weather near your fields</h2>
              <p>Get local conditions and rain outlook.</p>
              {error && <p className="field-weather-error" role="status">{error}</p>}
            </div>
          </div>
          <button type="button" onClick={loadWeather} disabled={loading}>
            {loading ? "Finding location…" : error ? "Try again" : "Use my location"}
          </button>
        </div>
      )}
      {(loading || error) && weather && (
        <p className="field-weather-status" role="status">
          {loading ? "Updating local weather…" : error}
        </p>
      )}
    </section>
  );
}