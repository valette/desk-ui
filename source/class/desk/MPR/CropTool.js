
/**
 * Tool to crop volumes
 * @ignore(THREE.*)
*/

qx.Class.define("desk.MPR.CropTool", 
{
	extend : qx.ui.container.Composite,
	include : desk.WindowMixin,

	construct : function( MPRContainer, volume ) {

		this.base( arguments );
		this.setLayout( new qx.ui.layout.VBox( 5 ) );
		this.set({ width : 300, height : 100 } );
		this.__MPRContainer = MPRContainer;
		this.__volume = volume;
        this.__checkBox = new qx.ui.form.CheckBox( "Custom output directory" );
        this.__outputDirectory = new desk.FileField();
        this.__outputDirectory.setPlaceholder( "outputdirectory here" );
        this.__outputDirectory.setEnabled( false );
        this.__checkBox.bind( "value", this.__outputDirectory, "enabled" );
        this.add( this.__checkBox );
        this.add( this.__outputDirectory );
        this.__button = new qx.ui.form.Button( "crop" );
        this.__button.addListener( "execute", this.__crop, this );
        this.add( this.__button, { flex : 1 } );

        this.__init();
        qx.util.DisposeUtil.disposeTriggeredBy( this, MPRContainer );
        qx.util.DisposeUtil.disposeTriggeredBy( this, volume );
        setImmediate( () => this.getWindow().setAlwaysOnTop( true ) );

	},

    destruct : function () {
        const viewers = this.__MPRContainer.getViewers();
        for ( let [ index,  data ] of this.__all.entries() ) {
            data.controls.dispose();
            viewers[ index ].getScene().remove( data.frame, ...data.spheres );
        }
        this.__MPRContainer.render();
        this.getWindow().close();
    },

    statics : {

		/**
		* Create a copy of a THREE.Box3 into a bounds[ 6 ] array (usefull to convert to VTK bounds)
		*
		* @param box {THREE.Box3} the input THREE.Box3
		* @param bounds {Array} destination array 
		*/

        boxToBounds : function ( box, bounds ) {
        
            bounds[ 0 ] = box.min.x;
            bounds[ 1 ] = box.max.x;
            bounds[ 2 ] = box.min.y;
            bounds[ 3 ] = box.max.y;
            bounds[ 4 ] = box.min.z;
            bounds[ 5 ] = box.max.z;

        },

		/**
		* Create a copy of a VTK-style bounds array into a THREE.Box3		*
		* @param bounds {Array} input bounds
		* @param box {THREE.Box3} output THREE.Box3
		*/

        boundsToBox : function( bounds, box ) {
            
            box.min.set( bounds[ 0 ], bounds[ 2 ], bounds[ 4 ] );
            box.max.set( bounds[ 1 ], bounds[ 3 ], bounds[ 5 ] );

        }

    },

	events : {

		/**
		* Fired whenever a volume has been cropped
		*/
		"croppedVolume" : "qx.event.type.Data"

	},


	members : {

        __MPRContainer : null,
        __volume : null,
        __sphereGeometry : null,
        __sphereMaterial : null,
        __box : null,
        __originalBox : null,
        __bounds : null,
        __all : null,
        __button : null,
        __checkBox : null,
        __outputDirectory : null,

        __toBounds : [ [ [ 0, 2 ], [ 1, 2 ], [ 1, 3 ], [ 0, 3 ] ],
             [ [ 4, 2 ], [ 5, 2 ], [ 5, 3 ], [ 4, 3 ] ],
             [ [ 0, 4 ], [ 1, 4 ], [ 1, 5 ], [ 0, 5 ] ]
        ],

        __initSliceView : function( sliceView ) {

    		const frameGeometry = new THREE.BufferGeometry();
    		const vertices = new Float32Array( 15 );
    		frameGeometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
    
    		const lineMaterial = new THREE.MeshBasicMaterial({
    			color: this.__sphereMaterial.color,
    			side:THREE.DoubleSide,
    			transparent : true,
    			depthTest : false
    		});
    
    		const frame = new THREE.Line( frameGeometry, lineMaterial );
            sliceView.getScene().add( frame );
    		frame.renderOrder = 9000;
    
            const spheres = [ 0, 1, 2, 3 ].map( ( i ) => {
    
                const sphere = new THREE.Mesh( this.__sphereGeometry, this.__sphereMaterial );
                sphere.userData.toBounds = this.__toBounds[ sliceView.getOrientation() ][ i ];
                sliceView.getScene().add( sphere );
                return sphere;
    
            });
    
            const update = () => {
    
                for ( let sphere of spheres ) {
    
                    sphere.position.x = this.__bounds[ sphere.userData.toBounds[ 0 ] ];
                    sphere.position.y = this.__bounds[ sphere.userData.toBounds[ 1 ] ];
                    sphere.position.z = 0;
    
                }
    
                const toBoundsLocal = this.__toBounds[ sliceView.getOrientation() ];
        		const vertices = frameGeometry.attributes.position.array;
    
    			for ( let i = 0; i < 5; i++) {
    				vertices[ 3 * i ] =  this.__bounds[ toBoundsLocal[ i % 4 ][ 0 ] ];
    				vertices[ 3 * i + 1 ] =  this.__bounds[ toBoundsLocal[ i % 4 ][ 1 ] ];
    				vertices[ 3 * i + 2 ] =  0;
    			}
    
    			frameGeometry.attributes.position.needsUpdate = true;
    
            };
    
            const controls = new THREE.DragControls( spheres, sliceView.getCamera(), sliceView.getRenderer().domElement );
            controls.addEventListener( "hoveron", () => sliceView.setCrossLocked( true ) );
            controls.addEventListener( "hoveroff", () => sliceView.setCrossLocked( false) );
            controls.addEventListener( "drag", ( e ) => {
                const sphere = e.object;
                this.__bounds[ sphere.userData.toBounds[ 0 ] ] = sphere.position.x;
                this.__bounds[ sphere.userData.toBounds[ 1 ] ] = sphere.position.y;
                this.__updateAll();
            });
    
            return { spheres, update, controls, frame };
    
        },

        __updateAll : function() {
        
            for ( let component = 0; component < 3; component++ ) {
                const min = Math.min( this.__bounds[ component * 2 ], this.__bounds[ 1 + component * 2 ] );
                const max = Math.max( this.__bounds[ component * 2 ], this.__bounds[ 1 + component * 2 ] );
                this.__bounds[ component * 2 ] = min;
                this.__bounds[ 1 + component * 2 ] = max;
            }
    
            desk.MPR.CropTool.boundsToBox( this.__bounds, this.__box );
            this.__box.intersect( this.__originalBox );
            desk.MPR.CropTool.boxToBounds( this.__box, this.__bounds );
            for ( let data of this.__all ) data.update();
            this.__MPRContainer.render();

        },

        __croppedVolume : null,
    
        __crop  : async function () {

            try {
                this.__button.setEnabled( false );
                const slice = this.__volume.getSlices()[ 0 ];
                const spacing = slice.getSpacing();
                const origin = slice.getOrigin();
                const bounds = this.__bounds;
        
                const params = {
                    action : "volumeCrop",
                    inputVolume : this.__volume.getFile(),
                    xMin : Math.round( ( bounds[ 0 ] - origin[ 0 ] ) / spacing[ 0 ] ),
                    xMax : Math.round( ( bounds[ 1 ] - origin[ 0 ] ) / spacing[ 0 ] ),
                    yMin : Math.round( ( bounds[ 2 ] - origin[ 1 ] ) / spacing[ 1 ] ),
                    yMax : Math.round( ( bounds[ 3 ] - origin[ 1 ] ) / spacing[ 1 ] ),
                    zMin : Math.round( ( bounds[ 4 ] - origin[ 2 ] ) / spacing[ 2 ] ),
                    zMax : Math.round( ( bounds[ 5 ] - origin[ 2 ] ) / spacing[ 2 ] )
                };

                if ( this.__checkBox.getValue() ) {

                    const dir = this.__outputDirectory.getValue();

                    if ( !dir || !dir.trim().length ) {

                        alert( "output directory is not set!");
                        throw( "Output directory not set");

                    }

                    params.outputDirectory = dir.trim();

                }

                if ( this.__croppedVolume )
					this.__MPRContainer.removeVolume( this.__croppedVolume );

                const crop = await desk.Actions.executeAsync( params );
                this.__croppedVolume = this.__MPRContainer.addVolume( crop.outputDirectory + "output.nii.gz", {label : "cropped" } );

				this.fireDataEvent( "croppedVolume", this.__croppedVolume )

                this.__MPRContainer.setCrossFloatPosition(
					this.__box.getCenter( new THREE.Vector3 ) );

            } catch ( e ) { console.warn( e ); }
            finally { this.__button.setEnabled( true ); }

        },

        __init : async function () {

            await this.__volume.ready();
            const slice = this.__volume.getSlices()[ 0 ];
            this.__bounds = slice.getBounds();
            const viewers = this.__MPRContainer.getViewers();
            const sliceView = viewers[ 0 ];
            this.__box = new THREE.Box3();
            desk.MPR.CropTool.boundsToBox( this.__bounds, this.__box );
            this.__originalBox = this.__box.clone();
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            this.__box.getCenter( center );
            this.__box.getSize( size );
            this.__box.setFromCenterAndSize( center, size.multiplyScalar( 0.5) );
            desk.MPR.CropTool.boxToBounds( this.__box, this.__bounds );
            this.__sphereGeometry = new THREE.SphereGeometry( size.length() / 50, 8, 8 );
            this.__sphereMaterial = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
            this.__all = viewers.map( this.__initSliceView, this );
            this.__updateAll();

        }

	}

});
