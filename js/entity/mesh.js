import { getTriangleNormal } from "../lib/math-helpers.js";

export class Mesh {
	#positions = [];
	#colors = [];
	#triangles = [];
	#triangleNormals = [];

	constructor(mesh){
		this.#positions = mesh.positions;
		this.#colors = mesh.colors;
		this.#triangles = mesh.triangles;
		this.#triangleNormals = this.#triangles.map(t => getTriangleNormal(this.#positions[t[0]], this.#positions[t[1]], this.#positions[t[2]]));
	}
	get positions(){
		return this.#positions;
	}
	get triangles(){
		return this.#triangles;
	}
	get colors(){
		return this.#colors;
	}
	get triangleNormals(){
		return this.#triangleNormals;
	}
	get type(){
		return "mesh";
	}
}