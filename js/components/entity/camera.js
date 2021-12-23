import { UP, subtractVector, crossVector, normalizeVector } from "../lib/vector.js";
import { cartesianToLatLng, latLngToCartesian, clamp } from "../lib/math-helpers.js";

export class Camera {
	#position = [0, 0, -1];
	#target = [0, 0, 0];
	#screenWidth;
	#screenHeight;
	#near = 0.01;
	#far = 5;

	constructor(camera) {
		this.#position = camera.position;
		this.#screenWidth = camera.screenWidth;
		this.#screenHeight = camera.screenHeight;
		this.#near = camera.near ?? this.#near;
		this.#far = camera.far ?? this.#far;
	}

	moveTo(x, y, z) {
		this.#position = [x, y, z];
	}

	moveBy({ x = 0, y = 0, z = 0 }) {
		this.#position[0] += x;
		this.#position[1] += y;
		this.#position[2] += z;
	}

	panBy({ x = 0, y = 0, z = 0 }) {
		this.#position[0] += x;
		this.#target[0] += x;
		this.#position[1] += y;
		this.#target[1] += y;
		this.#position[2] += z;
		this.#target[2] += z;
	}

	orbitBy({ lat = 0, long = 0, radius = 0 }) {
		const [r, currentLat, currentLng] = this.getOrbit();
		const newLat = clamp(currentLat + lat, -Math.PI / 2, Math.PI / 2);
		const newRadius = Math.max(0.1, r + radius);
		this.#position = latLngToCartesian([newRadius, newLat, currentLng - long]);
	}

	zoomBy(value) {
		const [r, currentLat, currentLng] = this.getOrbit();
		const newRadius = Math.max(0.1, r / value);
		this.#position = latLngToCartesian([newRadius, currentLat, currentLng]);
	}

	lookAt(x, y, z) {
		this.#target = [x, y, z];
	}

	getForwardDirection(){
		return normalizeVector(subtractVector(this.#target, this.#position));
	}

	getRightDirection(){
		return crossVector(UP, this.getForwardDirection());
	}

	getUpDirection(){
		return crossVector(this.getForwardDirection(), this.getRightDirection());
	}

	getAspectRatio(){
		return this.#screenWidth / this.#screenHeight;
	}

	getOrbit() {
		const targetDelta = subtractVector(this.#position, this.#target);
		return cartesianToLatLng(targetDelta);
	}

	getPosition() {
		return this.#position;
	}

	setPosition(position) {
		this.#position = position;
	}
}