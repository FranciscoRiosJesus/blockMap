//URL LOCAL
//const BACK_URL="http://localhost:3000/";

//URL RENDER
const BACK_URL = "https://blockmarkermap.onrender.com/"

function initMap() {
    const map = new google.maps.Map(document.getElementById("map"), {
        zoom: 17,
        center: { lat: -34.568, lng: -58.468 },
        mapTypeId: "terrain",
    });

    getLocationAndCenterMap(map);

    geolocationMarker(map);

    getBlocksFromDb(map);

    getLocationButton(map);

    getColorDescription(map);

}

window.initMap = initMap;

async function saveDateInDb(date, blockName, terr, map) {
    terr.features = terr.features.map(block => {
        if (block.properties.Name === blockName) {
            block.properties.dateUpdate = date;
        }
        return block;
    });

    try {
        console.log("Saving");
        const res = await fetch(`${BACK_URL}${terr._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(terr)
        });
        const result = await res.json();

        //TODO: DELETE POLYGONS
        //deletePolygons(map);

        //createPolygons(result, map);
    } catch (error) {
        console.error(error);
    }
}

function getBlocksFromDb(map) {
    fetch(BACK_URL)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Error al cargar el archivo JSON: ${response.status}`);
            }
            return response.json()
        })
        .then((json) => {
            createTerritories(json, map)
        });
}

function createTerritories(json, map) {
    json.forEach(terr => {
        createPolygons(terr, map);
    });
}

function createPolygons(terr, map) {
    infoWindow = new google.maps.InfoWindow();

    terr.features.forEach(block => {
        function getPaths(points) {
            let paths = [];
            points.forEach(point => {
                paths.push({ lat: point[1], lng: point[0] })
            })
            return paths
        }
        //create a polygon
        const paths = getPaths(block.geometry.coordinates[0]);
        const blockPoligon = new google.maps.Polygon({
            paths: paths,
            strokeColor: "#6eb43b",
            strokeOpacity: 0.4,
            strokeWeight: 0,
            fillColor: getFillColorOfBlock(block.properties.dateUpdate, block.properties.Name.split(":")[0]),
            fillOpacity: 0.35,
        });

        blockPoligon.addListener("click", async () =>
            createInfoWindow(block, infoWindow, map, paths, terr, blockPoligon));

        blockPoligon.setMap(map);
    })
}

async function createInfoWindow(block, infoWindow, map, paths, terr, blockPoligon) {
    await setInfoWindowContent(block, infoWindow, map, paths);

    let button = document.querySelector(".button");
    if (!button) {
        window.setTimeout(() => {
            button = document.querySelector(".button");
        }, 9000);
    }
    button.addEventListener("click", async () => {
        handleButtonClick(block.properties.Name, terr, blockPoligon, map)
        await createInfoWindow(block, infoWindow, map, paths, terr, blockPoligon);
    })
}

async function setInfoWindowContent(block, infoWindow, map, paths) {
    infoWindow.setPosition(paths[0]);
    await infoWindow.setContent(
        '<form class="form" action="">' +
        '<div class="name"> Territorio: ' + block.properties.Name.split(":")[0] +
        ' <br/> Manzana: ' + block.properties.Name.split(":")[1] + '' +
        ' <br/> Ultima Actualización: ' + getDate(block.properties.dateUpdate) + '</div>' +
        '<div>' +
        '<input class="dateInput" type="date" name="begin" placeholder="dd-mm-yyyy" value="" min="1997-01-01" max="' + new Date().toISOString().split('T')[0] + '">' +
        '</div>' +
        '<div>' +
        '<input  class="button" type="button" value="Hecho">' +
        '</div>' +
        '</form>'
    );

    infoWindow.open({
        map
    });
    map.setCenter(paths[0]);
}

function getDate(date) {
    return date ? formatDate(date?.split("T")[0]) : 'Aun no censada'
}

function formatDate(date) {
    return date.split("-").reverse().join("/")
}

function getFillColorOfBlock(dateUpdate, territory) {
    const VERDE = {
        "1A": "#00B50B",
        "1B": "#4CBD49",
        "2": "#447C5F",
        "3": "#3B7B4E",
        "4": "#406A3D",
        "5": "#3D5B2C",
        "6": "#7ea783",
        "7": "#b6d7a8",
        "8": "#baea99",
    }
    const AMARILLO = "#FFFF00"
    const NARANJA = "#FFA500"
    const ROJO = "#FF0000"

    if (dateUpdate) {
        const actualDate = new Date()

        const date60DaysAgo = new Date(actualDate);
        date60DaysAgo.setDate(actualDate.getDate() - 60);

        const date120DaysAgo = new Date(actualDate);
        date120DaysAgo.setDate(actualDate.getDate() - 120);

        const date360DaysAgo = new Date(actualDate);
        date360DaysAgo.setDate(actualDate.getDate() - 360);

        if (new Date(dateUpdate) < actualDate && new Date(dateUpdate) > date60DaysAgo) {
            return ROJO
        } else if (new Date(dateUpdate) < date60DaysAgo && new Date(dateUpdate) > date120DaysAgo) {
            return NARANJA
        } else if (new Date(dateUpdate) < date120DaysAgo && new Date(dateUpdate) > date360DaysAgo) {
            return AMARILLO
        } else {
            return VERDE[territory]
        }
    } else {
        return VERDE[territory]
    }
}

function handleButtonClick(blockName, terr, blockPoligon, map) {
    let date = document.querySelector(".dateInput").value;
    if (date === "") {
        date = new Date();
        const offset = date.getTimezoneOffset();
        date = new Date(date.getTime() - (offset * 60 * 1000));
        date = date.toISOString().split('T')[0];
    }

    saveDateInDb(date, blockName, terr, map);

    //CHANGE COLOR OF POLYGON
    updateColorOfPolygon(blockPoligon, date, blockName.split(":")[0]);
}

function updateColorOfPolygon(blockPoligon, dateUpdate, territory) {
    let color = getFillColorOfBlock(dateUpdate, territory)

    blockPoligon.setOptions({
        fillColor: color
    })
}

function getLocationAndCenterMap(map) {
    window.setTimeout(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const pos = { lat: latitude, lng: longitude };

                    infoWindow.setPosition(pos);
                    infoWindow.setContent("Location found.");
                    infoWindow.open(map);
                    map.setCenter(pos);
                },
                () => {
                    handleLocationError(true, infoWindow, map.getCenter());
                }
            );
        } else {
            handleLocationError(false, infoWindow, map.getCenter());
        }
    }, 3000);
}

function geolocationMarker(map) {
    let userMarker;

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition((position) => {
            const { latitude, longitude } = position.coords;
            const pos = { lat: latitude, lng: longitude };

            const customIcon = {
                url: "./icons/geolocation.png",
                scaledSize: new google.maps.Size(45, 40),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(15, 15),
            };

            if (!userMarker) {
                userMarker = new google.maps.Marker({
                    position: pos,
                    map,
                    title: "Tu ubicación",
                    icon: customIcon,
                    opacity: 0.5
                });
            } else {
                userMarker.setPosition(pos);
            }

            //map.setCenter(pos);
        },
            (error) => {
                console.error(error);
            });
    } else {
        console.error("Geolocation is not supported by this browser.");
    }
}

function getLocationButton(map) {
    const locationButton = document.createElement("button");
    locationButton.textContent = "Mi ubicación";
    locationButton.classList.add("custom-map-control-button");
    map.controls[google.maps.ControlPosition.BOTTOM_LEFT].push(locationButton);
    locationButton.addEventListener("click", () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const pos = { lat: latitude, lng: longitude };

                    infoWindow.setPosition(pos);
                    infoWindow.setContent("Location found.");
                    infoWindow.open(map);
                    map.setCenter(pos);
                },
                () => {
                    handleLocationError(true, infoWindow, map.getCenter());
                }
            );
        } else {
            handleLocationError(false, infoWindow, map.getCenter());
        }
    });
}

function getColorDescription(map) {
    const parent = document.createElement("div");
    parent.classList.add("descriptions");

    const greenDescription = document.createElement("div");
    parent.appendChild(greenDescription);
    greenDescription.textContent = "Verde: Censar";
    greenDescription.classList.add("green-description");

    const yellowDescription = document.createElement("div");
    parent.appendChild(yellowDescription);
    yellowDescription.textContent = "Amarillo: Hecho hace 60 días";
    yellowDescription.classList.add("yellow-description");

    const orangeDescription = document.createElement("div");
    parent.appendChild(orangeDescription);
    orangeDescription.textContent = "Naranja: Hecho hace 120 días";
    orangeDescription.classList.add("orange-description");

    const redDescription = document.createElement("div");
    parent.appendChild(redDescription);
    redDescription.textContent = "Rojo: Hecho hace 360 días";
    redDescription.classList.add("red-description");

    map.controls[google.maps.ControlPosition.TOP_CENTER].push(parent);
}
