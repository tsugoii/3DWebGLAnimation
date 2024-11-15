"use strict";

var gl;   // The webgl context.

var a_coords_loc;         // Location of the a_coords attribute variable in the shader program.
var a_normal_loc;         // Location of a_normal attribute 

var u_modelview;       // Locations for uniform matrices
var u_projection;
var u_normalMatrix;

var u_material;     // An object tolds uniform locations for the material.
var u_lights;       // An array of objects that holds uniform locations for light properties.

var projection = mat4.create();    // projection matrix
var modelview;                     // modelview matrix; value comes from rotator
var normalMatrix = mat3.create();  // matrix, derived from modelview matrix, for transforming normal vectors

var rotator;  // A TrackballRotator to implement rotation by mouse.

var frameNumber = 0;  // frame number during animation (actually only goes up by 0.5 per frame)

var torus, sphere, cone, cylinder, disk, ring, cube;  // basic objects, created using function createModel

var matrixStack = [];           // A stack of matrices for implementing hierarchical graphics.

var currentColor = [1,1,1,1];   // The current diffuseColor; render() functions in the basic objects set
                                // the diffuse color to currentColor when it is called before drawing the object.
                                // Other color properties, which don't change often are handled elsewhere.

var sunAngle = Math.PI/2; // rotation of the sun about the z-axis.
var daytime = true;

let UFOEnabled = false;
let carEnabled = true;
let sunColor = 'white';

//Draws the image
function draw() {
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    mat4.perspective(projection, Math.PI/4, 1, 1, 50);
    gl.uniformMatrix4fv(u_projection, false, projection );

    modelview = rotator.getViewMatrix();
    lights();
    world();
}

/* Set the direction vector of a light, in eye coordinates.
 * (Note: This function sets the value of the global variable normalMatrix.)
 * @param modelview the matrix that does object-to-eye coordinate transforms
 * @param u_direction_loc the uniform variable location for the spotDirection property of the light
 * @param lightDirection a vector that points in the direction that the spotlight is pointing (a vec3) */
function setSpotlightDirection( u_direction_loc, modelview, lightDirection ) {
    mat3.normalFromMat4(normalMatrix,modelview);
    var transformedDirection = new Float32Array(3);
    vec3.transformMat3(transformedDirection, lightDirection, normalMatrix);
    gl.uniform3fv(u_direction_loc, transformedDirection);
}

/* Set the position of a light, in eye coordinates.
 * @param u_position_loc the uniform variable location for the position property of the light
 * @param modelview the matrix that does object-to-eye coordinate transforms
 * @param lightPosition the location of the light, in object coordinates (a vec4) */
function setLightPosition( u_position_loc, modelview, lightPosition ) {
    var transformedPosition = new Float32Array(4);
    vec4.transformMat4(transformedPosition, lightPosition, modelview);
    gl.uniform4fv(u_position_loc, transformedPosition);
}

function lights() {
    if (daytime) {  // light 1 is the sun

        if(sunColor == 'white'){
            gl.uniform3f( u_lights[1].color, 1, 1, 1 ); // light 1 is the sun during the day
        } else if(sunColor == 'red'){
        gl.uniform3f( u_lights[1].color, 1, 0.5,0.3 ); // light 1 is the sun during the day
        } else if(sunColor == 'yellow'){
            gl.uniform3f( u_lights[1].color, .95, 0.8, 0.05 );
        } else {
            gl.uniform3f( u_lights[1].color, 0.6, 0.6, 0.5 ); 
        }

        gl.uniform1f( u_lights[1].attenuation, 0 );// light 1 is the sun during the day
    }
    else {
        gl.uniform3f( u_lights[1].color, 1, 1, 0.8 ); // light 1 is the lamp at night
        gl.uniform1f( u_lights[1].attenuation, 2 );
    }
    
    currentColor = [ 0.3, 0.3, 0.3, 1 ];
    
    pushMatrix();  // draw the sun, with yellow emissive color during the day, dim whita at night; NB: sun won't be illuminated by other lights
    mat4.rotateZ(modelview,modelview,sunAngle);
    mat4.translate(modelview,modelview,[6.5,0,0]);
    mat4.scale(modelview,modelview,[0.4,0.4,0.4]);
    if (daytime) { 
        gl.uniform3f( u_material.emissiveColor, 0.7, 0.7, 0 );
        setLightPosition(u_lights[1].position, modelview, [1,0,0,0]);
    }
    else {
        gl.uniform3f(u_material.emissiveColor, 0.1, 0.1, 0.1 );
    }
    sphere.render();
    gl.uniform3f( u_material.emissiveColor, 0, 0, 0 );
    popMatrix();
    
    pushMatrix();  // draw the lamp, with emissive color at night
    mat4.translate(modelview,modelview,[0,1.5,0]);
    mat4.scale(modelview,modelview,[0.15,0.15,0.15]);
    if (!daytime) { 
        setLightPosition(u_lights[1].position, modelview, [0,0,0,1]);
        gl.uniform3f( u_material.emissiveColor, 0.5, 0.5, 0 );
    }
    sphere.render();
    gl.uniform3f( u_material.emissiveColor, 0, 0, 0 );
    popMatrix();
    
    // turn on the headlights at night -- we need all the transforms that are applied to the car
    if (daytime) {
        gl.uniform1f( u_lights[2].enabled, 0 );
        gl.uniform1f( u_lights[3].enabled, 0 );
        gl.uniform1f( u_lights[4].enabled, 0 );
    }
    else {
        gl.uniform1f( u_lights[2].enabled, carEnabled ? 1 : 0 );
        gl.uniform1f( u_lights[3].enabled, carEnabled ? 1 : 0 );
        gl.uniform1f( u_lights[4].enabled, UFOEnabled ? 1 : 0 );
        pushMatrix();
        mat4.rotate(modelview,modelview,(-frameNumber)/180*Math.PI,[ 0, 1, 0]);
        mat4.translate(modelview,modelview,[0,0.3,4]);
        mat4.scale(modelview,modelview,[0.3,0.3,.3]);
        pushMatrix();
        mat4.translate(modelview,modelview,[-3,0.6,-1]);
        mat4.rotateY(modelview,modelview,-Math.PI/12);  // (bogus rotation to point headlights more along road)
        setLightPosition(u_lights[2].position, modelview, [0,0,0,1]);
        setSpotlightDirection(u_lights[2].spotDirection, modelview, [-1,0,0]);
        popMatrix();
        pushMatrix();
        mat4.translate(modelview,modelview,[-3,0.6,1]);
        mat4.rotateY(modelview,modelview,-Math.PI/12);
        setLightPosition(u_lights[3].position, modelview, [0,0,0,1]);
        setSpotlightDirection(u_lights[3].spotDirection, modelview, [-1,0,0]);
        popMatrix();
        pushMatrix();
        mat4.translate(modelview,modelview,[7.5,10,-2]);
        mat4.rotateY(modelview,modelview,Math.PI/12);
        setLightPosition(u_lights[4].position, modelview, [0,0,0,1]);
        setSpotlightDirection(u_lights[4].spotDirection, modelview, [0,-1,0]);
        popMatrix();
        popMatrix();
    }
}

/** Draws a "world" consisting of a disk holding some trees and a road, and a car that
 * drives along the road.*/
function world() {
	pushMatrix();
	mat4.translate(modelview,modelview,[0,-0.05,0]);
	mat4.rotate(modelview,modelview,(90)/180*Math.PI,[1,0,0]);
	currentColor = [0.1,0.4,0.1,1];
	disk.render();
	popMatrix();
    pushMatrix();
	mat4.rotate(modelview,modelview,(90)/180*Math.PI,[-1,0,0]);
    mat4.scale(modelview,modelview,[0.15,0.15,1.5]);
    currentColor = [0.8,0.8,1,1];
    cylinder.render();
    popMatrix();
	pushMatrix();
	currentColor = [0.7,0.7,0.8,1];
	mat4.rotate(modelview,modelview,(90)/180*Math.PI,[-1,0,0]);
	ring.render();
	popMatrix();
	pushMatrix();
	mat4.rotate(modelview,modelview,(-frameNumber)/180*Math.PI,[ 0, 1, 0]);
	mat4.translate(modelview,modelview,[0,0.3,4]);
	mat4.scale(modelview,modelview,[0.3,0.3,.3]);

    if(carEnabled){
        car();
    }
	if(UFOEnabled) {
        UFO();
    }
    popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[1,0,0]);
	mat4.scale(modelview,modelview,[0.7,0.7,0.7]);
	tree();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[-0.5,0,-1]);
	mat4.scale(modelview,modelview,[0.5,0.5,0.5]);
	tree();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[-1.5,0,2]);
	mat4.scale(modelview,modelview,[0.7,0.7,0.7]);
	tree();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[-1,0,5.2]);
	mat4.scale(modelview,modelview,[0.25,0.25,0.25]);
	tree();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[5.1,0,0.5]);
	mat4.scale(modelview,modelview,[0.3,0.3,0.3]);
	tree();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[5.1,0,-0.5]);
	mat4.scale(modelview,modelview,[0.35,0.35,0.35]);
	tree();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[5.3,0,0]);
	mat4.scale(modelview,modelview,[0.5,0.5,0.5]);
	tree();
	popMatrix();
	pushMatrix();
	mat4.rotate(modelview,modelview,(70)/180*Math.PI,[0,1,0]);
	pushMatrix();
	mat4.translate(modelview,modelview,[5.1,0,0.5]);
	mat4.scale(modelview,modelview,[0.3,0.3,0.3]);
	tree();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[5.1,0,-0.5]);
	mat4.scale(modelview,modelview,[0.35,0.35,0.35]);
	tree();
	popMatrix();
	mat4.rotate(modelview,modelview,(53)/180*Math.PI,[0,1,0]);
	pushMatrix();
	mat4.translate(modelview,modelview,[5.3,0,0]);
	mat4.scale(modelview,modelview,[0.5,0.5,0.5]);
	tree();
	popMatrix();
	popMatrix();
}

// Draws a tree consisting of a green cone with a brown cylinder for a trunk.
function tree() {
	pushMatrix();
	mat4.rotate(modelview,modelview,(90)/180*Math.PI,[-1,0,0]);
	pushMatrix();
	currentColor = [0.5,0.3,0.1,1];
	mat4.scale(modelview,modelview,[0.5,0.5,1]);
	cylinder.render();
	popMatrix();
	pushMatrix();
	currentColor = [0,0.8,0,1];
	mat4.translate(modelview,modelview,[0,0,0.8]);
	mat4.scale(modelview,modelview,[1.5,1.5,2]);
	cone.render();
	popMatrix();
	popMatrix();
}

/** Draws a car consisting of two scaled red cubes with headlights
 * and four wheels on two axels.*/
function car() {
	pushMatrix();
	mat4.translate(modelview,modelview,[2.5,0,0]);
	axel();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[-2.5,0,0]);
	axel();
	popMatrix();
	currentColor = [1,0,0,1];
	pushMatrix();
	mat4.translate(modelview,modelview,[0,0.6,0]);
	mat4.scale(modelview,modelview,[6,1.2,3]);
	cube.render();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[0.5,1.4,0]);
	mat4.scale(modelview,modelview,[3,1,2.8]);
	cube.render();
	popMatrix();
	currentColor = [1,1,0.3,1];
    if (!daytime) {
       gl.uniform3f(u_material.emissiveColor, 0.4,0.4,0);
    }
	pushMatrix();
	mat4.translate(modelview,modelview,[-3,0.6,-1]);
	mat4.scale(modelview,modelview,[0.1,0.25,0.25]);
	sphere.render();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[-3,0.6,1]);
	mat4.scale(modelview,modelview,[0.1,0.25,0.25]);
	sphere.render();
	popMatrix();
    gl.uniform3f(u_material.emissiveColor, 0,0,0);
}

/**Draw an axel that consists of a long yellow cylinder with
 *  a wheel on each end.*/
function axel() {
	currentColor = [0.8,0.7,0,1];
	pushMatrix();
	mat4.scale(modelview,modelview,[0.2,0.2,4.3]);
	mat4.translate(modelview,modelview,[0,0,-0.5]);
	cylinder.render();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[0,0,2]);
	wheel();
	popMatrix();
	pushMatrix();
	mat4.translate(modelview,modelview,[0,0,-2]);
	wheel();
	popMatrix();
}

/** Draw a rotating wheel that consists of a torus with three
 * cylinders to make the spokes of the wheel.*/
function wheel() {
	pushMatrix();
	mat4.rotate(modelview,modelview,(frameNumber*10)/180*Math.PI,[0,0,1]);
	currentColor = [0,0,0.7,1];
	torus.render();
	currentColor = [0.9,0.9,0.6,1];
	pushMatrix();
	mat4.rotate(modelview,modelview,(90)/180*Math.PI,[-1,0,0]);
	mat4.scale(modelview,modelview,[0.1,0.1,1.8]);
	mat4.translate(modelview,modelview,[0,0,-0.5]);
	cylinder.render();
	popMatrix();
	pushMatrix();
	mat4.rotate(modelview,modelview,(60)/180*Math.PI,[0,0,1]);
	mat4.rotate(modelview,modelview,(90)/180*Math.PI,[-1,0,0]);
	mat4.scale(modelview,modelview,[0.1,0.1,1.8]);
	mat4.translate(modelview,modelview,[0,0,-0.5]);
	cylinder.render();
	popMatrix();
	pushMatrix();
	mat4.rotate(modelview,modelview,(-60)/180*Math.PI,[0,0,1]);
	mat4.rotate(modelview,modelview,(90)/180*Math.PI,[-1,0,0]);
	mat4.scale(modelview,modelview,[0.1,0.1,1.8]);
	mat4.translate(modelview,modelview,[0,0,-0.5]);
	cylinder.render();
	popMatrix();
	popMatrix();
}

function UFO() {
    currentColor = [0,0,0.7,1];
    pushMatrix();
    mat4.rotate(modelview,modelview,(90)/180*Math.PI,[-1,0,0]);
    mat4.scale(modelview,modelview,[3,3,3]);
    mat4.translate(modelview,modelview,[2.5,.8,5]);
    torus.render();
    pushMatrix();
    mat4.rotate(modelview,modelview,(90)/180*Math.PI,[-1,0,0]);
    mat4.scale(modelview,modelview,[.2,.2,.2]);
    mat4.translate(modelview,modelview,[0,0,4.5]);
    sphere.render();
    popMatrix();
    pushMatrix();
    mat4.rotate(modelview,modelview,(90)/180*Math.PI,[-1,0,0]);
    mat4.scale(modelview,modelview,[.2,.2,.2]);
    mat4.translate(modelview,modelview,[0,0,-4.5]);
    sphere.render();
    popMatrix();
    popMatrix();
}

//Push a copy of the current modelview matrix onto the matrix stack.
function pushMatrix() {
    matrixStack.push( mat4.clone(modelview) );
}

// Restore the modelview matrix to a value popped from the matrix stack.
function popMatrix() {
    modelview = matrixStack.pop();
}

/**Create one of the basic objects.  The modelData holds the data for
 *  an IFS using the structure from basic-objects-IFS.js.  This function
 *  creates VBOs to hold the coordinates, normal vectors, and indices
 *  from the IFS, and it loads the data into those buffers.  The function
 *  creates a new object whose properties are the identifies of the
 *  VBOs.  The new object also has a function, render(), that can be called to
 *  render the object, using all the data from the buffers.  That object
 *  is returned as the value of the function.  (The second parameter,
 *  xtraTranslate, is there because this program was ported from a Java
 *  version where cylinders were created in a different position, with
 *  the base on the xy-plane instead of with their center at the origin.
 *  The xtraTranslate parameter is a 3-vector that is applied as a
 *  translation to the rendered object.  It is used to move the cylinders
 *  into the position expected by the code that was ported from Java.)*/
function createModel(modelData, xtraTranslate) {
    var model = {};
    model.coordsBuffer = gl.createBuffer();
    model.normalBuffer = gl.createBuffer();
    model.indexBuffer = gl.createBuffer();
    model.count = modelData.indices.length;
    if (xtraTranslate)
        model.xtraTranslate = xtraTranslate;
    else
        model.xtraTranslate = null;
    gl.bindBuffer(gl.ARRAY_BUFFER, model.coordsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexPositions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexNormals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, modelData.indices, gl.STATIC_DRAW);
    model.render = function() {  // This function will render the object.
           // Since the buffer from which we are taking the coordinates and normals
           // change each time an object is drawn, we have to use gl.vertexAttribPointer
           // to specify the location of the data. And to do that, we must first
           // bind the buffer that contains the data.  Similarly, we have to
           // bind this object's index buffer before calling gl.drawElements.
        gl.bindBuffer(gl.ARRAY_BUFFER, this.coordsBuffer);
        gl.vertexAttribPointer(a_coords_loc, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(a_normal_loc, 3, gl.FLOAT, false, 0, 0);
        gl.uniform4fv(u_material.diffuseColor, currentColor);
        if (this.xtraTranslate) {
            pushMatrix();
            mat4.translate(modelview,modelview,this.xtraTranslate);
        }
        gl.uniformMatrix4fv(u_modelview, false, modelview );
        mat3.normalFromMat4(normalMatrix, modelview);
        gl.uniformMatrix3fv(u_normalMatrix, false, normalMatrix);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
        if (this.xtraTranslate) {
            popMatrix();
        }
    }
    return model;
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type String is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 *    The second and third parameters are the id attributes for <script>
 * elementst that contain the source code for the vertex and fragment
 * shaders.*/
function createProgram(gl, vertexShaderID, fragmentShaderID) {
    function getTextContent( elementID ) {
            // This nested function retrieves the text content of an
            // element on the web page.  It is used here to get the shader
            // source code from the script elements that contain it.
        var element = document.getElementById(elementID);
        var node = element.firstChild;
        var str = "";
        while (node) {
            if (node.nodeType == 3) // this is a text node
                str += node.textContent;
            node = node.nextSibling;
        }
        return str;
    }
    try {
        var vertexShaderSource = getTextContent( vertexShaderID );
        var fragmentShaderSource = getTextContent( fragmentShaderID );
    }
    catch (e) {
        throw "Error: Could not get shader source code from script elements.";
    }
    var vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vertexShaderSource);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw "Error in vertex shader:  " + gl.getShaderInfoLog(vsh);
     }
    var fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fragmentShaderSource);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw "Error in fragment shader:  " + gl.getShaderInfoLog(fsh);
    }
    var prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw "Link error in program:  " + gl.getProgramInfoLog(prog);
    }
    return prog;
}

// Initialize the WebGL context.  Called from init() 
function initGL() {
    var prog = createProgram(gl,"vshader-source","fshader-source");
    gl.useProgram(prog);
    gl.enable(gl.DEPTH_TEST);
    
    // Get attribute and uniform locations
    a_coords_loc =  gl.getAttribLocation(prog, "a_coords");
    a_normal_loc =  gl.getAttribLocation(prog, "a_normal");
    gl.enableVertexAttribArray(a_coords_loc);
    gl.enableVertexAttribArray(a_normal_loc);
    
    u_modelview = gl.getUniformLocation(prog, "modelview");
    u_projection = gl.getUniformLocation(prog, "projection");
    u_normalMatrix =  gl.getUniformLocation(prog, "normalMatrix");
    u_material = {
        diffuseColor: gl.getUniformLocation(prog, "material.diffuseColor"),
        specularColor: gl.getUniformLocation(prog, "material.specularColor"),
        emissiveColor: gl.getUniformLocation(prog, "material.emissiveColor"),
        specularExponent: gl.getUniformLocation(prog, "material.specularExponent")
    };
    u_lights = new Array(5);
    for (var i = 0; i < u_lights.length; i++) {
        u_lights[i] = {
            enabled: gl.getUniformLocation(prog, "lights[" + i + "].enabled"),
            position: gl.getUniformLocation(prog, "lights[" + i + "].position"),
            color: gl.getUniformLocation(prog, "lights[" + i + "].color"),
            spotDirection: gl.getUniformLocation(prog, "lights[" + i + "].spotDirection"),
            spotCosineCutoff: gl.getUniformLocation(prog, "lights[" + i + "].spotCosineCutoff"),
            spotExponent: gl.getUniformLocation(prog, "lights[" + i + "].spotExponent"),
            attenuation: gl.getUniformLocation(prog, "lights[" + i + "].attenuation")
        };
    }
            
    gl.uniform3f( u_material.specularColor, 0.1, 0.1, 0.1 );  // specular properties don't change
    gl.uniform1f( u_material.specularExponent, 16 );
    gl.uniform3f( u_material.emissiveColor, 0, 0, 0);  // default, will be changed temporarily for some objects

    for (var i = 1; i < u_lights.length; i++) { // set defaults for lights
        gl.uniform1i( u_lights[i].enabled, 0 ); 
        gl.uniform4f( u_lights[i].position, 0, 0, 1, 0 );
        gl.uniform1f( u_lights[i].spotCosineCutoff, 0); // not a spotlight
        gl.uniform3f( u_lights[i].spotDirection, 0,0,-1);
        gl.uniform1f( u_lights[i].spotExponent, 5);
        gl.uniform1f( u_lights[i].attenuation, 0); // no attenuation
        gl.uniform3f( u_lights[i].color, 1,1,1 ); 
    }
    
    gl.uniform1i( u_lights[0].enabled, 1 );   // viewpoint light
    gl.uniform4f( u_lights[0].position, 0,0,0,1 ); // positional, at viewpoint
    gl.uniform3f( u_lights[0].color, 0.2,0.2,0.2 );  // dim
    gl.uniform1i( u_lights[1].enabled, 1 );   // the sun during the day, the lamp at night
    gl.uniform1f( u_lights[2].spotCosineCutoff, Math.cos(Math.PI/8) ); // lights 2 and 3 are headlights,
    gl.uniform1f( u_lights[3].spotCosineCutoff, Math.cos(Math.PI/8) ); //    which are spotlights
    gl.uniform1f( u_lights[4].spotCosineCutoff, Math.cos(Math.PI/16) );
    gl.uniform3f( u_lights[2].color, 0.5, 0.5, 0.4 );  
    gl.uniform3f( u_lights[3].color, 0.5, 0.5, 0.4 );
    gl.uniform3f( u_lights[4].color, 1, 1, 1 );
    // Note: position and spot direction for lights 1 to 4 are managed by modeling transforms.
}
 
var animating = false;

function frame() {
    if (animating) {
        frameNumber += 1;
        sunAngle += Math.PI/360;
        if (sunAngle > 2*Math.PI) {
            sunAngle -= 2*Math.PI;
        }
        daytime = sunAngle < Math.PI;
        draw();
        requestAnimationFrame(frame);
    }
}

function setAnimating(run) {
    if (run != animating) {
        animating = run;
        if (animating)
            requestAnimationFrame(frame);
    }
}

const reset = () => {
    //    document.getElementById("animCheck").checked;
       carEnabled = document.getElementById("car").checked;
       if(document.getElementById("redSun")?.checked){
        sunColor = 'red';
       } else if (document.getElementById("whiteSun")?.checked){
        sunColor = 'white';
       } else if(document.getElementById("yellowSun")?.checked){
        sunColor = 'yellow';}
       UFOEnabled = document.getElementById("UFO")?.checked;
       initGL();
       rotator.setView(17,[0,1,2]);
       frameNumber = 0;
       sunAngle = Math.PI/2;
       daytime = true;
       draw();
}

//initialization function that will be called when the page has loaded
function init() {
    try {
        var canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl") || 
                         canvas.getContext("experimental-webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("message").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("message").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context:" + e + "</p>";
        return;
    }
    document.getElementById("animCheck").checked = false;
    document.getElementById("car").checked = true;
    document.getElementById("UFO").checked = false;
    document.getElementById("redSun").checked = false;
    document.getElementById("yellowSun").checked = false;
    document.getElementById("whiteSun").checked = true;
    document.getElementById("reset").onclick = function() {
       animating = false;
       document.getElementById("animCheck").checked = false;
       document.getElementById("car").checked = true;
       document.getElementById("UFO").checked = false;
       document.getElementById("redSun").checked = false;
       document.getElementById("yellowSun").checked = false;
       document.getElementById("whiteSun").checked = true;
       reset();
    }
    
    torus = createModel(uvTorus(0.5,1,16,8));   // Create all the basic objects.
    sphere = createModel(uvSphere(1));
    cone = createModel(uvCone(),[0,0,.5]);
    cylinder = createModel(uvCylinder(),[0,0,.5]);
    disk = createModel(uvCylinder(5.5,0.5,64),[0,0,.25]);
    ring = createModel(ring(3.3,4.8,40));
    cube = createModel(cube());
 
    rotator = new TrackballRotator(canvas,function() {
        if (!animating)
           draw();
    },17,[0,1,2]);
    draw();
}