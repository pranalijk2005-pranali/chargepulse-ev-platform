import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationSelector({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng, isLiveGPS: false });
      }
    },
  });
  return null;
}

function MapController({ userLocation, selectedStation }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    if (selectedStation?.lat && selectedStation?.lng) {
      map.setView([Number(selectedStation.lat), Number(selectedStation.lng)], 15);
    } else if (userLocation?.lat && userLocation?.lng) {
      map.setView([Number(userLocation.lat), Number(userLocation.lng)], 14);
    }

    return () => clearTimeout(timer);
  }, [userLocation, selectedStation, map]);

  return null;
}

export default function EVMap({
  userLocation,
  stations = [],
  selectedStation,
  onSelectStation,
  onOpenGoogleMaps,
  onLocationSelect,
}) {
  const userPos = [
    Number(userLocation?.lat) || 17.6599,
    Number(userLocation?.lng) || 75.9064,
  ];

  const routePositions =
    selectedStation?.lat && selectedStation?.lng
      ? [userPos, [Number(selectedStation.lat), Number(selectedStation.lng)]]
      : null;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={userPos}
        zoom={14}
        style={{ height: '100%', width: '100%', borderRadius: '1.5rem' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <MapController userLocation={userLocation} selectedStation={selectedStation} />
        <LocationSelector onLocationSelect={onLocationSelect} />

        {routePositions && (
          <Polyline
            positions={routePositions}
            pathOptions={{ color: '#10b981', weight: 5, opacity: 0.85 }}
          />
        )}

        <Marker position={userPos}>
          <Popup>
            <div className="text-slate-900 font-sans">
              <strong>Current Location</strong>
              <br />
              <span className="text-xs text-slate-600">Click anywhere on map to move pin</span>
            </div>
          </Popup>
        </Marker>

        {stations.map((st) => (
          <Marker
            key={st.stationId || st._id}
            position={[Number(st.lat), Number(st.lng)]}
            eventHandlers={{
              click: () => onSelectStation && onSelectStation(st),
            }}
          >
            <Popup>
              <div className="text-slate-900 font-sans p-1 space-y-2 max-w-xs">
                <div>
                  <strong className="text-sm font-bold block">{st.name}</strong>
                  <span className="text-xs text-slate-600">
                    {st.address} ({st.district})
                  </span>
                </div>
                <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                  {st.calculatedDistanceKm != null
                    ? `${st.calculatedDistanceKm} km away`
                    : 'Calculating...'}
                </div>

                {onOpenGoogleMaps && (
                  <button
                    onClick={() => onOpenGoogleMaps(st)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition shadow"
                  >
                    <span>Open Real Google Maps</span>
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
