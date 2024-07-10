import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { Icon, Style, Stroke, Fill, Text } from 'ol/style';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import { getDistance } from 'ol/sphere';
import ol, { DoubleClickZoom, KeyboardZoom, MouseWheelZoom } from 'ol/interaction';
import { Zoom } from 'ol/control';
import { Circle } from 'ol/geom';
import { useTranslation } from 'react-i18next';
import sendEvent from './utils/sendEvent';
const hintMul = 5000000 / 20000; //5000000 for all countries (20,000 km)

const MapComponent = ({ options, ws, session, pinPoint, setPinPoint, answerShown, location, setKm, guessing, multiplayerSentGuess, multiplayerState, showHint, currentId, round, gameOptions, focused }) => {
  const mapRef = useRef();
  const [map, setMap] = useState(null);
  const [randomOffsetS, setRandomOffsetS] = useState([0, 0]);
  const plopSound = useRef();
  const vectorSource = useRef(new VectorSource());
  const { t: text } = useTranslation("common");


  function drawHint(initialMap, location, randomOffset) {
    // create a circle overlay 10000km radius from location

    let lat = location.lat;
    let long = location.long
    let center = fromLonLat([long, lat]);
    center = [center[0] + randomOffset[0], center[1] + randomOffset[1]];
    // move it a bit randomly so it's not exactly on the location but location is inside the circle
    const circle = new Feature(new Circle(center, hintMul * (gameOptions?.maxDist ?? 0)));
    vectorSource.current.addFeature(circle);

    const circleLayer = new VectorLayer({
      source: new VectorSource({
        features: [circle]
      }),
      style: new Style({
        stroke: new Stroke({
          color: '#f00',
          width: 2
        })
      })
    });
    initialMap.addLayer(circleLayer);
  }
  // Initialize map on first render
  useEffect(() => {
    const initialMap = new Map({
      target: mapRef.current,
      layers: [
        // osm
        new TileLayer({
          source: new XYZ({
            // url: 'https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
            // url: 'https://cdn.lima-labs.com/{z}/{x}/{y}.png?api=0430HugnWftuqjsktunChwMvi2HsvythMMwighNwoJtJascQA02',
            // use google maps https://mt2.google.com/vt/lyrs=m&x=&y==&z=&hl=en
            url: options?.mapType==="legacy"?'https://cdn.lima-labs.com/{z}/{x}/{y}.png?api=0430HugnWftuqjsktunChwMvi2HsvythMMwighNwoJtJascQA02':`https://mt2.google.com/vt/lyrs=${options?.mapType ?? 'm'}&x={x}&y={y}&z={z}&hl=${text("lang")}`,
          }),
        }),
        new VectorLayer({ source: vectorSource.current })
      ],
      view: new View({
        center: fromLonLat([2, 35]),
        zoom: 1,
        zoomFactor: 2.5,
      }),
    });

    var duration = 400;
    initialMap.addControl(new Zoom({
      duration: duration
    }));
    initialMap.addInteraction(new MouseWheelZoom({
      duration: duration
    }));
    initialMap.addInteraction(new DoubleClickZoom({
      duration: duration
    }));
    initialMap.addInteraction(new KeyboardZoom({
      duration: duration
    }));


    // const mouseDown = (e) => {
    //   if (!guessed && !guessing) {
    //     e.preventDefault();
    //     const pixel = initialMap.getEventPixel(e);
    //     const clickedCoord = initialMap.getCoordinateFromPixel(pixel);
    //     const clickedLatLong = toLonLat(clickedCoord);
    //     setPinPoint({ lat: clickedLatLong[1], lng: clickedLatLong[0] });
    //   }
    // };
    // mapRef.current.addEventListener('mousedown', mouseDown);

    // use map click event to set pin point
    function onMapClick(e) {
      if (!answerShown && !guessing  &&  (!multiplayerState?.inGame || (multiplayerState?.inGame && !multiplayerState?.gameData?.players.find(p => p.id === multiplayerState?.gameData?.myId)?.final))) {
        const clickedCoord = initialMap.getEventCoordinate(e.originalEvent);
        const clickedLatLong = toLonLat(clickedCoord);
        setPinPoint({ lat: clickedLatLong[1], lng: clickedLatLong[0] });

        if(multiplayerState?.inGame && multiplayerState.gameData?.state === "guess" && ws) {
              console.log("pinpoint1", pinPoint)
              var pinpointLatLong = [clickedLatLong[1], clickedLatLong[0]]
              ws.send(JSON.stringify({ type: "place", latLong: pinpointLatLong, final: false }))

        }

        if(plopSound.current) plopSound.current.play();
      }
    }
    initialMap.on('click', onMapClick);

    setMap(initialMap);

    return () => {
      initialMap.setTarget(undefined);
      // if(mapRef.current) mapRef.current.removeEventListener('mousedown', mouseDown);

      initialMap.un('click', onMapClick);
    };
  }, [answerShown, setPinPoint, guessing, multiplayerState?.gameData?.state, multiplayerState?.inGame, ws]);

  // Update pin point and add line
  useEffect(() => {
    if (!map) return;


    vectorSource.current.clear();

    // remove old pin point
    // no clue why this is needed twice but it is
    for (let i = 0; i < 2; i++) {
      map.getLayers().getArray().forEach((layer) => {
        if (layer instanceof VectorLayer) {
          map.removeLayer(layer);
        }
      });
    }

    if (location && showHint) drawHint(map, location, randomOffsetS, gameOptions.maxDist);
    if (pinPoint) {
      const pinFeature = new Feature({
        geometry: new Point(fromLonLat([pinPoint.lng, pinPoint.lat])),
      });
      const pinLayer = new VectorLayer({
        source: new VectorSource({
          features: [pinFeature]
        }),
        style: new Style({
          image: new Icon({
            anchor: [0.5, 1],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            scale: 0.45,
            src: '/src.png'
          })
        })
      });
      map.addLayer(pinLayer);

      if(answerShown) {
        const textLayer = new VectorLayer({
          source: new VectorSource({
            features: [
              new Feature({
                geometry: new Point(fromLonLat([pinPoint.lng, pinPoint.lat])),
                text: text('yourGuess')
              })
            ]
          }),
          style: new Style({
            text: new Text({
              font: 'bold 20px sans-serif',
              text: text('yourGuess'),
              offsetY: -65,
              fill: new Fill({
                color: '#000',
              }),
            }),
          }),
        });
        map.addLayer(textLayer);

      }
    }

    if(answerShown && location) {
      const destFeature = new Feature({
        geometry: new Point(fromLonLat([location.long, location.lat])),
      });

      const pinLayer = new VectorLayer({
        source: new VectorSource({
          features: [destFeature]
        }),
        style: new Style({
          image: new Icon({
            anchor: [0.5, 1],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
            scale: 0.45,
            src: '/dest.png'
          })
        })
      });


      map.addLayer(pinLayer);

      // add text above pin
      const textLayer = new VectorLayer({
        source: new VectorSource({
          features: [
            new Feature({
              geometry: new Point(fromLonLat([location.long, location.lat])),
              text: text('theLocation')
            })
          ]
        }),
        style: new Style({
          text: new Text({
            font: 'bold 20px sans-serif',
            text: text('theLocation'),
            offsetY: -65,
            fill: new Fill({
              color: '#000',
            }),
          }),
        }),
      });
      map.addLayer(textLayer);

    }
    if (answerShown && location && pinPoint) {
      const lineLayer = new VectorLayer({
        source: new VectorSource({
          features: [
            new Feature({
              geometry: new LineString([
                fromLonLat([pinPoint.lng, pinPoint.lat]),
                fromLonLat([location.long, location.lat]),
              ]),
            })
          ]
        }),
        style: new Style({
          stroke: new Stroke({
            color: '#f00',
            width: 2
          })
        })
      });

      map.addLayer(lineLayer);




      // if (playingMultiplayer) {
      //   // Add other players' guesses
      //   multiplayerGameData.players.forEach((player) => {
      //     if (player.g.findIndex((g) => g.r === round) !== -1) {
      //       const playerGuess = player.g.find((g) => g.r === round);
      //       if (playerGuess.lat === pinPoint.lat && playerGuess.long === pinPoint.lng) return;
      //       const playerFeature = new Feature({
      //         geometry: new Point(fromLonLat([playerGuess.long, playerGuess.lat])),
      //       });
      //       const playerLayer = new VectorLayer({
      //         source: new VectorSource({
      //           features: [playerFeature]
      //         }),
      //         style: new Style({
      //           image: new Icon({
      //             anchor: [0.5, 1],
      //             anchorXUnits: 'fraction',
      //             anchorYUnits: 'fraction',
      //             scale: 0.45,
      //             src: '/src2.png'
      //           })
      //         })
      //       });
      //       map.addLayer(playerLayer);
      //     }
      //   });
      // }

      if(multiplayerState?.inGame) {
        // Add other players' guesses

        multiplayerState?.gameData?.players.forEach((player) => {
          console.log("player", player)
          if (player.id === multiplayerState?.gameData?.myId) return;
          if (player.final && player.guess) {
            console.log("player.latLong", player.guess)
            const playerFeature = new Feature({
              geometry: new Point(fromLonLat([player.guess[1], player.guess[0]])),
            });
            const playerLayer = new VectorLayer({
              source: new VectorSource({
                features: [playerFeature]
              }),
              style: new Style({
                image: new Icon({
                  anchor: [0.5, 1],
                  anchorXUnits: 'fraction',
                  anchorYUnits: 'fraction',
                  scale: 0.45,
                  src: '/src2.png'
                })
              })
            });
            map.addLayer(playerLayer);

            // add text of playes name
            const textLayer = new VectorLayer({
              source: new VectorSource({
                features: [
                  new Feature({
                    geometry: new Point(fromLonLat([player.guess[1], player.guess[0]])),
                    text: player.username
                  })
                ]
              }),
              style: new Style({
                text: new Text({
                  font: 'bold 20px sans-serif',
                  text: player.username,
                  offsetY: -65,
                  fill: new Fill({
                    color: '#000',
                  }),
                }),
              }),
            });
            map.addLayer(textLayer);
          }
      });
    }





      // Calculate distance

      let distanceInKm = getDistance([pinPoint.lng, pinPoint.lat], [location.long, location.lat]) / 1000;
      if (distanceInKm > 100) distanceInKm = Math.round(distanceInKm);
      else if (distanceInKm > 10) distanceInKm = parseFloat(distanceInKm.toFixed(1));
      else distanceInKm = parseFloat(distanceInKm.toFixed(2));
      setKm(distanceInKm);
    }


    function onKeyPress(e) {
      console.log(focused, e.key)
      if(!focused) return;
      // arrow keys = move / pan
      // + - = zoom

      let f = 1.5
      if (e.key === 'ArrowUp') {
        const zoom = map.getView().getZoom();
        const distance = 1000000 / Math.pow(f, zoom);
        map.getView().animate({ center: [map.getView().getCenter()[0], map.getView().getCenter()[1] + distance], duration: 50 });
      } else if (e.key === 'ArrowDown') {
        const zoom = map.getView().getZoom();
        const distance = 1000000 / Math.pow(f, zoom);
        map.getView().animate({ center: [map.getView().getCenter()[0], map.getView().getCenter()[1] - distance], duration: 50 });
      } else if (e.key === 'ArrowLeft') {
        const zoom = map.getView().getZoom();
        const distance = 1000000 / Math.pow(f, zoom);
        map.getView().animate({ center: [map.getView().getCenter()[0] - distance, map.getView().getCenter()[1]], duration: 50 });
      } else if (e.key === 'ArrowRight') {
        const zoom = map.getView().getZoom();
        const distance = 1000000 / Math.pow(f, zoom);
        map.getView().animate({ center: [map.getView().getCenter()[0] + distance, map.getView().getCenter()[1]], duration: 50 });
      }

      if (e.key === '+' || e.key === '=') {
        map.getView().animate({ zoom: map.getView().getZoom() + 1, duration: 200 });
      } else if (e.key === '-' || e.key === '_') {
        map.getView().animate({ zoom: map.getView().getZoom() - 1, duration: 200 });
      }
    }

    window.addEventListener('keydown', onKeyPress);

    return () => {
      window.removeEventListener('keydown', onKeyPress);
    }

  }, [map, pinPoint, answerShown, location, setKm, randomOffsetS, showHint, focused]);

  useEffect(() => {
    if(!answerShown || !location || !map) return;
    console.log(answerShown, location, map)
    try {
    setTimeout(() => {
      map.getView().animate({ center: fromLonLat([location.long, location.lat]), zoom: 5, duration: 3000 });
    }, 100);
  }catch(e) {

  }

  }, [answerShown, location, map])

  useEffect(() => {
    if(!gameOptions || !location) return;
    // let maxPivots = [10, 25].map((v, i) => v * 0.8).map((v, i) => v * (Math.random() - 0.5) * 2);
    let maxPivots = [0, 0];
    const radiusProj = hintMul * gameOptions.maxDist;

    // move it a bit randomly so it's not exactly on the location but location is inside the circle (0 -> radiusProj)
    const randomAngle = Math.random() * 2 * Math.PI;
    const randomRadius = Math.random() * radiusProj;
    maxPivots[0] += Math.cos(randomAngle) * randomRadius;
    maxPivots[1] += Math.sin(randomAngle) * randomRadius;

    setRandomOffsetS([maxPivots[0], maxPivots[1]]);
  }, [location, gameOptions]);

  return (
    <>
    <div ref={mapRef} id='miniMapContent'></div>
    <audio ref={plopSound} src="/plop.mp3" preload="auto"></audio>
    </>
  );
};

export default MapComponent;
