/**
 * A Seedable Random Number Generator
 * @ignore (randomJS.*)
 */
qx.Class.define("desk.Random", 
{
	extend : qx.core.Object,

	/**
	* Constructor, with seed
	* @param seed {Integer} optional seed
	* <pre class="javascript">
	* example : <br>
	* var rng = new desk.Random(1234);<br>
	* for (var i = 0; i < 10; i++) {<br>
	*	console.log(rng.random());<br>
	* }<br>
	* will display 10 random numbers in the [0,1] range<br>
	* </pre>
	*/
	construct : function(seed) {
		this.base(arguments);

		if (seed === undefined) {
			seed = 1;
		}

		this.__engine = new randomJS.MersenneTwister19937().seed( seed );
		this.__distribution = randomJS.real( 0, 1, false );
	},

	members : {
		__random : null,
		__engine : null,

		/**
		 * Returns a random number in the [0,1] range
		 * @return {Float} random number
		 */
		random : function() {
			return this.__distribution( this.__engine );
		}
	}
});


