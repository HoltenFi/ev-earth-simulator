function ensureValidLocationSelections(settings) {
  if (settings.locations.length === 0) {
    settings.startLocation = "";
    settings.endLocation = "";
    return;
  }

  if (!settings.locations.includes(settings.startLocation)) {
    settings.startLocation = settings.locations[0];
  }

  if (!settings.locations.includes(settings.endLocation)) {
    settings.endLocation =
      settings.locations.find(
        (location) => location !== settings.startLocation
      ) || settings.locations[0];
  }
}

function buildLocationOption(location, isSelected) {
  const option = document.createElement("option");
  option.value = location;
  option.textContent = location;
  option.selected = isSelected;
  return option;
}

export function renderRouteLocationOptions({
  settings,
  startLocationSelect,
  endLocationSelect,
}) {
  ensureValidLocationSelections(settings);

  startLocationSelect.innerHTML = "";
  endLocationSelect.innerHTML = "";

  settings.locations.forEach((location) => {
    startLocationSelect.appendChild(
      buildLocationOption(location, location === settings.startLocation)
    );
    endLocationSelect.appendChild(
      buildLocationOption(location, location === settings.endLocation)
    );
  });
}

export function renderLocationList({
  settings,
  locationList,
  onRemoveLocation,
}) {
  locationList.innerHTML = "";

  settings.locations.forEach((location) => {
    const item = document.createElement("div");
    item.className = "location-item";

    const locationText = document.createElement("span");
    locationText.textContent = location;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Remove";
    deleteButton.addEventListener("click", () => {
      onRemoveLocation(location);
    });

    item.appendChild(locationText);
    item.appendChild(deleteButton);
    locationList.appendChild(item);
  });
}
