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
        <span>FIELD CONDITIONS</span>
        <span>LIVE WEATHER</span>
      </div>

      {weather ? (
        <>
          <div className="field-weather-main">
            <div className="field-weather-place">
              <img
                src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                alt=""
                width="64"
                height="64"
              />
              <div>
                <h2 id="field-weather-title">
                  {weather.location}{weather.country ? `, ${weather.country}` : ""}
                </h2>
                <p>{weather.description}</p>
              </div>
            </div>
            <p className="field-weather-temperature">{weather.temperatureC}<span>°C</span></p>
          </div>
          <div className="field-weather-details">
            <span>Feels like {weather.feelsLikeC}°C</span>
            <span>Humidity {weather.humidity}%</span>
            <span>Wind {weather.windKmh} km/h</span>
            <button type="button" onClick={loadWeather} disabled={loading}>
              {loading ? "Updating…" : "Refresh"}
            </button>
          </div>
          <div className="field-forecast">
            <h3>Today’s forecast <span>Every 3 hours</span></h3>
            {weather.todayForecast.length > 0 ? (
              <ol className="field-forecast-strip" aria-label="Weather forecast for the rest of today">
                {weather.todayForecast.map((period) => (
                  <li className="field-forecast-period" key={period.time}>
                    <time dateTime={period.time}>{period.time}</time>
                    <img
                      src={`https://openweathermap.org/img/wn/${period.icon}.png`}
                      alt={period.description}
                      width="36"
                      height="36"
                    />
                    <strong>{period.temperatureC}°</strong>
                    <span>{period.rainChance}% rain</span>
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
          <div>
            <h2 id="field-weather-title">Weather near your fields</h2>
            <p>Check current conditions for your location.</p>
            {error && <p className="field-weather-error" role="status">{error}</p>}
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