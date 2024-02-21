import React, {useEffect, useState} from 'react';
import './App.css';
import {GeoJSON, MapContainer, Polyline, TileLayer, useMapEvent} from 'react-leaflet';
import * as turf from '@turf/turf';

function createSquare(point1: [number, number], point2: [number, number], widthMeters: number): turf.Feature<turf.Polygon> {
    const p1 = turf.point(point1);
    const p2 = turf.point(point2);
    const bearing = turf.bearing(p1, p2);
    const perpendicularBearing1 = (bearing + 90) % 360;
    const perpendicularBearing2 = (bearing - 90) % 360;
    const start = turf.destination(p1, widthMeters, perpendicularBearing1, {units: 'meters'}).geometry.coordinates;
    return turf.polygon(
        [[
            start,
            turf.destination(p1, widthMeters, perpendicularBearing2, {units: 'meters'}).geometry.coordinates,
            turf.destination(p2, widthMeters, perpendicularBearing2, {units: 'meters'}).geometry.coordinates,
            turf.destination(p2, widthMeters, perpendicularBearing1, {units: 'meters'}).geometry.coordinates,
            start
        ]]
    )
}

function areaFromRoute(route: [number, number][], offsetMeters: number, closed: boolean): turf.Feature<turf.MultiPolygon | turf.Polygon> {
    route = route.map((p) => [p[1], p[0]]);
    const circles = [];
    for (const p of route) {
        circles.push(turf.circle(p, offsetMeters, {units: 'meters'}));
    }

    const squares = [];
    for (let i = 1; i < circles.length; i++) {
        squares.push(createSquare(route[i - 1], route[i], offsetMeters));
    }

    let mergedPolygons: turf.Feature<turf.Polygon | turf.MultiPolygon> = circles.pop()!;
    for (const c of circles) {
        mergedPolygons = turf.union(mergedPolygons, c)!;
    }

    for (const s of squares) {
        mergedPolygons = turf.union(mergedPolygons, s)!;
    }
    mergedPolygons.id = Date.now();
    if (closed) {
        if (mergedPolygons.geometry.type === 'MultiPolygon') {
            mergedPolygons.geometry.coordinates = mergedPolygons.geometry.coordinates.map((c) => [c[0]]);
        } else {
            mergedPolygons.geometry.coordinates = [mergedPolygons.geometry.coordinates[0]];
        }
    }
    return mergedPolygons;
}

function App() {
    const [route, setRoute] = useState<[number, number][]>([]);
    const [area, setArea] = useState<turf.Feature | null>(null);
    const [closed, setClosed] = useState(false);
    const [offsetM, setOffsetM] = useState(100);

    useEffect(() => {
        if (route.length > 1) {
            setArea(areaFromRoute(route, offsetM, closed));
        }
    }, [route, offsetM, closed]);

    const handleOffsetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setOffsetM(parseInt(event.target.value, 10));
    };

    const handleClosedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setClosed(event.target.checked);
    };

    return (<div>
            <MapContainer
                style={{position: 'fixed', height: "100vh", width: "100vw"}}
                center={[46.0569465, 14.5057515]}
                zoom={13}
            >
                <Events onLatLng={(l) => setRoute(route.concat([l]))}/>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                <Polyline positions={route} color="blue"/>
                {area && <GeoJSON key={'geo-json-' + area.id} data={area}/>}
            </MapContainer>
            <div style={{position: 'fixed', bottom: '20px', right: '20px'}}>
                <div>
                    <label>
                        Offset (meters):
                        <input type="range" min="1" max="1000" value={offsetM} onChange={handleOffsetChange}/>
                        {offsetM}m
                    </label>
                </div>
                <div>
                    <label>
                        Close Route:
                        <input type="checkbox" checked={closed} onChange={handleClosedChange}/>
                    </label>
                </div>
            </div>
        </div>
    );
}

const Events = (props: { onLatLng: (p: [number, number]) => any }) => {
    useMapEvent('click', (e) => {
        props.onLatLng([e.latlng.lat, e.latlng.lng]);
    });
    return null;
}

export default App;