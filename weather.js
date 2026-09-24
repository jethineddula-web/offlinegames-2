/* weather.js — local weather widget for OfflineGames
 * Shows weather where the player is, using only browser geolocation.
 * No API key, no server storage.
 * APIs: open-meteo.com (weather) + bigdatacloud.net (reverse geocode, optional)
 * Fits mobile perfectly — stacks on ≤560px.
 * Looks for #og-weather and populates #wx-* inside it. Safe to include on any page.
 */
(function(){
  "use strict";
  var statusEl = document.getElementById('wx-status');
  var tempEl = document.getElementById('wx-temp');
  var descEl = document.getElementById('wx-desc');
  var locEl = document.getElementById('wx-loc');
  var iconEl = document.getElementById('wx-icon');
  var windEl = document.getElementById('wx-wind');
  var humEl = document.getElementById('wx-hum');
  var retryBtn = document.getElementById('wx-retry');
  var card = document.getElementById('og-weather');
  if(!card) return; // no widget on this page

  var WMO={
    0:['Clear sky','☀️'],1:['Mainly clear','🌤️'],2:['Partly cloudy','⛅'],3:['Overcast','☁️'],
    45:['Fog','🌫️'],48:['Rime fog','🌫️'],
    51:['Light drizzle','🌦️'],53:['Drizzle','🌦️'],55:['Dense drizzle','🌧️'],
    56:['Light freezing drizzle','🌧️'],57:['Dense freezing drizzle','🌧️'],
    61:['Slight rain','🌧️'],63:['Moderate rain','🌧️'],65:['Heavy rain','🌧️'],
    66:['Light freezing rain','🌧️'],67:['Heavy freezing rain','🌧️'],
    71:['Slight snow','❄️'],73:['Moderate snow','❄️'],75:['Heavy snow','❄️'],77:['Snow grains','❄️'],
    80:['Slight showers','🌦️'],81:['Moderate showers','🌧️'],82:['Violent showers','⛈️'],
    85:['Slight snow showers','🌨️'],86:['Heavy snow showers','🌨️'],
    95:['Thunderstorm','⛈️'],96:['Thunderstorm hail','⛈️'],99:['Thunderstorm heavy hail','⛈️']
  };

  function setStatus(t){ if(statusEl) statusEl.textContent=t; }

  function show(data,lat,lon){
    var cur=data.current;
    if(!cur){ setStatus('No data'); return; }
    var info=WMO[cur.weather_code]||['','⛅'];
    if(iconEl) iconEl.textContent=info[1];
    if(tempEl) tempEl.textContent=Math.round(cur.temperature_2m)+'°';
    if(descEl) descEl.textContent=info[0]+' • Feels '+Math.round(cur.apparent_temperature)+'°';
    if(windEl) windEl.textContent='Wind '+Math.round(cur.wind_speed_10m)+' km/h';
    if(humEl) humEl.textContent='Humidity '+cur.relative_humidity_2m+'%';
    var playIcon=document.getElementById('play-wx-icon');
    var playTemp=document.getElementById('play-wx-temp');
    if(playIcon) playIcon.textContent=info[1];
    if(playTemp) playTemp.textContent=Math.round(cur.temperature_2m)+'° '+info[0];
    setStatus('Live • '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
    // reverse geocode — best effort, no key
    fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+lat+'&longitude='+lon+'&localityLanguage=en')
      .then(function(r){return r.json();})
      .then(function(j){
        var city=j.city||j.locality||j.principalSubdivision||'';
        var country=j.countryName||'';
        if(locEl) locEl.textContent=(city?city+', ':'')+country+' • '+lat.toFixed(2)+', '+lon.toFixed(2);
      })
      .catch(function(){ if(locEl) locEl.textContent=lat.toFixed(3)+', '+lon.toFixed(3); });
    card.style.display='';
  }

  function fetchWx(lat,lon){
    setStatus('Fetching…');
    fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto')
      .then(function(r){return r.json();})
      .then(function(d){ show(d,lat,lon); })
      .catch(function(){
        setStatus('Failed');
        if(retryBtn) retryBtn.style.display='inline';
        if(descEl) descEl.textContent='Could not fetch weather. Check connection.';
      });
  }

  function request(){
    if(!navigator.geolocation){
      setStatus('Not supported');
      if(descEl) descEl.textContent='Geolocation is not supported on this device.';
      return;
    }
    setStatus('Locating…');
    if(descEl) descEl.textContent='Requesting your location…';
    navigator.geolocation.getCurrentPosition(function(pos){
      fetchWx(pos.coords.latitude,pos.coords.longitude);
    }, function(err){
      setStatus(err.code===1?'Location denied':'Unavailable');
      if(descEl) descEl.textContent=err.code===1
        ? 'Location access denied. Allow location to see local weather where you are playing. Your location stays in your browser.'
        : 'Location unavailable. You can retry when you have signal.';
      if(retryBtn) retryBtn.style.display='inline';
      if(locEl) locEl.textContent='';
      card.style.display=''; // show even on deny so user sees message
    }, {enableHighAccuracy:false,timeout:10000,maximumAge:600000});
  }

  if(retryBtn) retryBtn.addEventListener('click', request);
  // show card immediately (with detecting state) so user sees it even before permission
  card.style.display='';
  request();
})();
