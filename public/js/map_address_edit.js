function initMap() {

    let old_lat = document.getElementById("lod_latitude").value
    let old_lon = document.getElementById("lod_longitude").value

    let lat = Number(old_lat)
    let lon = Number(old_lon)

    const myLatlng = { lat: lat, lng: lon };
    const map = new google.maps.Map(document.getElementById("address-map"), {
        zoom: 5,
        center: myLatlng,
    });

    let infoWindow = new google.maps.InfoWindow({
        content: "Your Location = {lat:"+old_lat+", lng:"+old_lon+"}",
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

        document.getElementById("edit_location_latitude").value = lat_lon.lat.toFixed(8);
        document.getElementById("edit_location_longitude").value = lat_lon.lng.toFixed(8);

        infoWindow.setContent(
          JSON.stringify(mapsMouseEvent.latLng.toJSON(), null, 2),
        );
        infoWindow.open(map);
    });
}
  
initMap()