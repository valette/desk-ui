/**
 * Simple TabView widget helper
 * @ignore ( _.findIndex )
 */

qx.Class.define("desk.TabView", 
{
	extend : qx.ui.tabview.TabView,

	construct : function() {

		this.base(arguments);

	},

	members : {

		/**
		 * Adds a tab to the view
		 * @param title {String} name of the tab
		 * @param element {qx.ui.container} container to put in the tab
		 * @return {qx.ui.tabview.Page} the constructed page
		*/
		addElement : function ( title, element ) {

			var page = new qx.ui.tabview.Page( title );
			var layout = new qx.ui.layout.VBox();
			page.setLayout( layout );
			page.add( element, { flex : 1 } );
			this.add( page );
			page.getButton().addListener( 'mousewheel' , this.__onMouseWheel, this );
			return page;

		},

		/**
		 * Handles mouse wheel to switch tab
		*/
		__onMouseWheel : function ( e ) {

			var children = this.getChildren();

			var index = _.findIndex( children, function ( child ) {

				return child.isVisible();

			} );

			children[ ( children.length + index - e.getWheelDelta() ) % children.length ]
				.getButton()
				.execute();

		}

	}

} );
