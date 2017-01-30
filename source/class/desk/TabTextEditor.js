/**
 * A text editor that can also execute javascript code
 * @lint ignoreDeprecated ( alert )
 * @lint ignoreDeprecated ( confirm )
 */
qx.Class.define("desk.TabTextEditor",
{
	extend : qx.core.Object,
	type : "singleton",

	/**
	* Creates a new text editor
	*/
	construct : function() {
	    this.base( arguments );
	},

	statics : {

		/**
		* Creates a new text editor
		* @param file {String} the file to edit
		* @param options {Object} options
		*/
		open : function( file, options ) {
		    options = options || {};
		    var self = desk.TabTextEditor.getInstance();
			var win = self.__window;
			if (!win) {

				win = self.__window = new qx.ui.window.Window();

				win.set( { layout : new qx.ui.layout.VBox(),
					height : 700, width : 700, showMinimize : false } );

				win.addListener( 'close', function () {
					var instance = desk.TabTextEditor.getInstance();
					instance.__tabView.getChildren().forEach( function (e) {
						e.destroy();
					});
					instance.__window.destroy();
					instance.__window = 0;
					instance.__pane = 0;
					instance.__fileBrowser = 0;
					instance.__dummyContainer = 0;
				});

				win.setCaption( "Desk Text Editor" );

				self.__tabView = new desk.TabView();
				win.add( self.__tabView, { flex : 1 } );
				self.__addLocalStorage();
				win.open();
				win.center();

			}

			var found = false;
			self.__tabView.getChildren().forEach(function (e) {
				if (e.getLabel() === file) {
					found = true;
					e.getButton().execute();
				}
			});

			win.getLayoutParent().getWindowManager().bringToFront(win); 
			if (found) return;

			var editor = new desk.TextEditor( file, Object.assign( {
                }, options, { standalone : false } ) );

			var element = self.__tabView.addElement( file, editor );
			element.getButton().execute();
			element.setShowCloseButton( true );
			element.show();
			element.addListener( 'close', editor.destroy, editor );

			win.addListener( 'maximize', self.__onMaximize, self );
			win.addListener( 'restore', self.__onRestore, self );
		}

	},

	members : {

        __window : null,
        __pane : null,
        __fileBrowser : null,
        __dummyContainer : null,

		/**
		* launched when restoring non-full screen cojnfig
		*/
        __onRestore : function () {

            this.__window.add( this.__tabView, { flex : 1} );
            this.__pane.setVisibility( "excluded" );
			this.__window.getLayoutParent().getWindowManager().bringToFront( this.__window ); 

        },

		/**
		* launched when the window is maximized
		*/
        __onMaximize : function () {

            if ( !this.__pane ) {

                this.__pane = new qx.ui.splitpane.Pane("horizontal");
                this.__window.add( this.__pane, { flex : 1 } );

                this.__window.addListener( 'changeZIndex', function () {

                    if ( this.__pane.getVisibility() !== "visible" ) return;

                    this.__window.setZIndex( -10000 );

                }, this);

                this.__fileBrowser = new desk.FileBrowser( '', true );
                this.__fileBrowser.getWindow().minimize();
                this.__pane.add( this.__fileBrowser.getLayoutParent(), 0 );
                this.__dummyContainer = new qx.ui.container.Composite(
                    new qx.ui.layout.VBox() );
                this.__pane.add( this.__dummyContainer, 1 );

            }

            this.__window.setZIndex( -10000 );
            this.__dummyContainer.add( this.__tabView, { flex : 1 } );
            this.__pane.setVisibility( "visible" );

        },

		/**
		* adds localStorage handling
		*/
        __addLocalStorage : function () {
            var prefix = 'desk.TextEditor.';
            var files = Object.keys( localStorage )
                .filter( function ( key ) {
                    return key.indexOf( prefix ) === 0;
                })
                .map( function ( key ) {
                    return key.slice( prefix.length );
                } )
                .sort();

            var container = new qx.ui.container.Composite( new qx.ui.layout.VBox() );
            var list = new qx.ui.form.List();
            list.setSelectionMode( 'multi' );

            files.forEach( function ( file ) {

                var item = new qx.ui.form.ListItem( file );
                list.add( item );

            });

            list.addListener( 'dblclick', function () {

                desk.TabTextEditor.open( list.getSelection()[ 0 ].getLabel(),
                    { localStorage : true } );

            } );

            container.add( list, { flex : 1 } );
            var container2 = new qx.ui.container.Composite( new qx.ui.layout.HBox() );
            container.add( container2 );

            var button = new qx.ui.form.Button( '+' );
            button.addListener( 'execute', function () {
                var file = prompt( 'Enter the name of file to create :');
                if ( !file ) return;

                var key = 'desk.TextEditor.' + file;
                if ( localStorage[ key ] ) {
                    alert( 'Error : name already exists' );
                    return;
                }

                list.add( new qx.ui.form.ListItem( file ) );
                localStorage[ key ] = "\n\n";

            } );
            container2.add( button, { flex : 2 } );
            var button2 = new qx.ui.form.Button( '-' );
            button2.addListener( 'execute', function () {
                var selection = list.getSelection();
                if ( !selection.length ) return;

                var confirmed = confirm( 'You are about to delete the files :\n'
                    + selection.map( function( item ) {
                            return item.getLabel();
                        } ).join( '\n' ) );

                if ( !confirmed ) return;

                selection.forEach( function ( item ) {
                    localStorage.removeItem( 'desk.TextEditor.' + item.getLabel() );
                    list.remove( item );
                } );
            } );
            container2.add( button2, { flex : 1 } );
            this.__tabView.addElement( 'localStorage', container );
        }

	}
});
