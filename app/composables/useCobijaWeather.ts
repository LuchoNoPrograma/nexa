interface OpenMeteoForecast {
  current?: {
    temperature_2m?: number
    apparent_temperature?: number
    relative_humidity_2m?: number
    weather_code?: number
    wind_speed_10m?: number
    wind_direction_10m?: number
    precipitation_probability?: number
  }
  daily?: {
    time?: string[]
    weather_code?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    precipitation_probability_max?: number[]
  }
}

interface WeatherDay {
  day: string
  icon: string
  temp: string
  rain: number
}

interface WeatherLocation {
  latitude: number
  longitude: number
  timezone: string
}

const COBIJA_LOCATION: WeatherLocation = {
  latitude: -11.0267,
  longitude: -68.7692,
  timezone: 'America/La_Paz',
}

const fallbackWeatherDays: WeatherDay[] = [
  { day: 'Hoy', icon: '/weather/day-cloudy-color-icon.svg', temp: '32° / 24°', rain: 10 },
  { day: 'Mar', icon: '/weather/day-sunny-color-icon.svg', temp: '31° / 23°', rain: 8 },
  { day: 'Mié', icon: '/weather/cloud-color-icon.svg', temp: '33° / 24°', rain: 18 },
  { day: 'Jue', icon: '/weather/day-cloudy-color-icon.svg', temp: '32° / 24°', rain: 22 },
  { day: 'Vie', icon: '/weather/day-sunny-color-icon.svg', temp: '31° / 23°', rain: 12 },
]

const dayFormatter = new Intl.DateTimeFormat('es-BO', { weekday: 'short' })

function roundWeather(value?: number) {
  return typeof value === 'number' ? Math.round(value) : undefined
}

function formatDayLabel(date?: string, index = 0) {
  if (index === 0) {
    return 'Hoy'
  }

  if (!date) {
    return fallbackWeatherDays[index]?.day ?? ''
  }

  const label = dayFormatter.format(new Date(`${date}T12:00:00`)).replace('.', '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function weatherIcon(code?: number, rainProbability?: number) {
  if (code && code >= 95) return '/weather/cloud-rain-lightning-color-icon.svg'
  if ((code && code >= 51 && code <= 82) || (rainProbability ?? 0) >= 55) return '/weather/cloud-rain-color-icon.svg'
  if (code === 0) return '/weather/day-sunny-color-icon.svg'
  if ([1, 2].includes(code ?? -1)) return '/weather/day-cloudy-color-icon.svg'
  if (code === 3 || (code && code >= 45 && code <= 48)) return '/weather/cloud-color-icon.svg'
  return '/weather/day-cloudy-color-icon.svg'
}

function weatherLabel(code?: number) {
  if (code === 0) return 'Despejado'
  if (code === 1) return 'Mayormente despejado'
  if (code === 2) return 'Parcialmente nublado'
  if (code === 3) return 'Nublado'
  if (code && code >= 45 && code <= 48) return 'Neblina'
  if (code && code >= 51 && code <= 67) return 'Llovizna'
  if (code && code >= 80 && code <= 82) return 'Lluvias aisladas'
  if (code && code >= 95) return 'Tormenta'
  return 'Parcialmente nublado'
}

function buildOpenMeteoUrl(location: WeatherLocation) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: location.timezone,
    forecast_days: '5',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  })

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

export async function useWeatherForecast(location: WeatherLocation, cacheKey = 'open-meteo-weather') {
  const { data, error, pending } = await useFetch<OpenMeteoForecast>(buildOpenMeteoUrl(location), {
    key: cacheKey,
    server: false,
  })

  const currentWeather = computed(() => {
    const current = data.value?.current

    return {
      temp: roundWeather(current?.temperature_2m) ?? 28,
      feelsLike: roundWeather(current?.apparent_temperature) ?? 30,
      condition: weatherLabel(current?.weather_code),
      icon: weatherIcon(current?.weather_code, current?.precipitation_probability),
      wind: roundWeather(current?.wind_speed_10m) ?? 12,
      humidity: roundWeather(current?.relative_humidity_2m) ?? 78,
      rain: roundWeather(current?.precipitation_probability) ?? 10,
    }
  })

  const weatherDays = computed<WeatherDay[]>(() => {
    const daily = data.value?.daily
    const times = daily?.time ?? []

    if (!times.length) {
      return fallbackWeatherDays
    }

    return times.slice(0, 5).map((date, index) => {
      const max = roundWeather(daily?.temperature_2m_max?.[index])
      const min = roundWeather(daily?.temperature_2m_min?.[index])
      const rain = roundWeather(daily?.precipitation_probability_max?.[index]) ?? 0

      return {
        day: formatDayLabel(date, index),
        icon: weatherIcon(daily?.weather_code?.[index], rain),
        temp: `Máx. ${max ?? '--'}° / Mín. ${min ?? '--'}°`,
        rain,
      }
    })
  })

  const weatherStatus = computed(() => {
    if (pending.value) return 'Actualizando clima'
    if (error.value) return 'Datos de respaldo'
    return 'Open-Meteo'
  })

  return {
    currentWeather,
    weatherDays,
    weatherStatus,
  }
}

export function useCobijaWeather() {
  return useWeatherForecast(COBIJA_LOCATION, 'cobija-open-meteo-weather')
}
