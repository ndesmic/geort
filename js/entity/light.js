export class Light {
	#position;
	#color;

	constructor(light) {
		this.#position = light.position ?? [0, 0, 0];
		this.#color = light.color ?? [1, 1, 1, 1];
	}

	get position(){
		return this.#position;
	}

	get color(){
		return this.#color;
	}
}