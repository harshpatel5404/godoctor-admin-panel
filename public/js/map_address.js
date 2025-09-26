function initMap() {
    const myLatlng = { lat: 21.241387, lng: 72.825972 };
    const map = new google.maps.Map(document.getElementById("address-map"), {
        zoom: 5,
        center: myLatlng,
    });

    let infoWindow = new google.maps.InfoWindow({
        content: "Click the map to get Lat/Lng!",
        position: myLatlng,
    });
  
    infoWindow.open(map);

    map.addListener("click", (mapsMouseEvent) => {

        infoWindow.close();

        infoWindow = new google.maps.InfoWindow({
          position: mapsMouseEvent.latLng,
        });

        let address_lat_lon = mapsMouseEvent.latLng
        let lat_lon = address_lat_lon.toJSON()

        document.getElementById("location_latitude").value = lat_lon.lat.toFixed(8)
        document.getElementById("location_longitude").value = lat_lon.lng.toFixed(8)

        infoWindow.setContent(
          JSON.stringify(mapsMouseEvent.latLng.toJSON(), null, 2),
        );
        infoWindow.open(map);
    });
}
  
initMap()