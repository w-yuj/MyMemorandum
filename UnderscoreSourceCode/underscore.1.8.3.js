//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2017 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

//立即执行函数形式防止变量污染全局环境
(function () {

	// Baseline setup
	// --------------

	// Establish the root object, `window` (`self`) in the browser, `global`
	// on the server, or `this` in some virtual machines. We use `self`
	// instead of `window` for `WebWorker` support.
	//获取全局对象，在浏览器中是self或者window，在服务器端（Node）中是global。
	//在浏览器控制台中输入self或者self.self，结果都是window。
	var root = typeof self == 'object' && self.self === self && self ||
		typeof global == 'object' && global.global === global && global ||
		this ||
		{};

	// Save the previous value of the `_` variable.
	//保存之前全局对象中_属性的值。
	var previousUnderscore = root._;

	// Save bytes in the minified (but not gzipped) version:
	//保存一些常用内置对象的原型到变量中，加速引用。
	var ArrayProto = Array.prototype, ObjProto = Object.prototype;
	var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

	// Create quick reference variables for speed access to core prototypes.
	//保存一些常用方法保存到变量中，加速引用。
	var push = ArrayProto.push,
		slice = ArrayProto.slice,
		toString = ObjProto.toString,
		hasOwnProperty = ObjProto.hasOwnProperty;

	// All **ECMAScript 5** native function implementations that we hope to use
	// are declared here.
	var nativeIsArray = Array.isArray,
		nativeKeys = Object.keys,
		nativeCreate = Object.create;

	// Naked function reference for surrogate-prototype-swapping.
	//在144行使用到该变量，作用是作为一个构造函数创建空白对象，在创建之前指定要继承的原型，在创建之后将该函数原型指向null。

	var Ctor = function () { };

	// Create a safe reference to the Underscore object for use below.
	//_可以作为构造函数，也可以作为一般的普通函数。
	//当_(obj)调用时，会先检测obj是否是_的一个实例，如果是，则直接返回obj。
	//否则返回new新构建的对象实例，此时会把_作为构造函数使用。
	//当作为构造函数使用时，会把obj赋值给新实例的_wrapped属性。
	//内部存在obj instanceof _检测的原因在于需要使得_([])==_(_([]))。
	var _ = function (obj) {
		if (obj instanceof _)
			return obj;
		if (!(this instanceof _)) //检测this的指向
			return new _(obj);
		this._wrapped = obj;
	};

	// Export the Underscore object for **Node.js**, with
	// backwards-compatibility for their old module API. If we're in
	// the browser, add `_` as a global object.
	// (`nodeType` is checked to ensure that `module`
	// and `exports` are not HTML elements.)
	//为Node环境导出underscore，如果存在exports对象或者module.exports对象并且这两个对象不是HTML DOM，那么即为Node环境。
	//如果不存在以上对象，把_变量赋值给全局环境（浏览器环境下为window）。
	if (typeof exports != 'undefined' && !exports.nodeType) {
		if (typeof module != 'undefined' && !module.nodeType && module.exports) {
			exports = module.exports = _;
		}
		exports._ = _;
	} else {
		root._ = _;
	}

	// Current version.
	//当前版本。
	_.VERSION = '1.8.3';

  /*
  该函数在201行中的调用具有说明意义，通过_.each函数（说明文档：http://www.bootcss.com/p/underscore/#each）的使用我们可以理解这个函数的作用。
  func参数是我们传递的回调函数，即为说明文档中的iteratee参数。
  context参数使我们传递的上下文对象，即为说明文档中的context参数。
  如果我们使用时传递了上下文对象，那么将会把iteratee回调函数中的this指向我们传递的上下文对象。
  举例：
	  	var obj = {};
		_.each([1,2,3], function(v, k, o){
			this[k] = v;
		}, obj);

		console.log(obj);

  	输出obj的内容即为{'0':1,'1':2,'2':3}
  */
	var optimizeCb = function (func, context, argCount) {
		/*
		这部分void 0是全文中第一次出现，为什么会出现void 0值得我们思考。
		其实这里的void 0就等价于undefined，为什么不直接用undefined呢？
		因为在低版本IE浏览器中，undefined不是保留关键字，可以被我们重写，为了避免undefined被重写导致出现错误，我们需要找到替代品。
		void后接任何值都会返回undefined。
		就算现在在ES5+中undefined已经是一个Read-Only属性，但是在局部作用域，undefined还是可以被重写。
		另外一个原因就是void 0长度小于undefined，有利于压缩代码。
		参考文章：https://github.com/hanzichi/underscore-analysis/issues/1。
		*/
		if (context === void 0) return func;
		switch (argCount) {
			case 1: return function (value) {
				return func.call(context, value);
			};
			// The 2-parameter case has been omitted only because no current consumers
			// made use of it.
			case null:
			case 3: return function (value, index, collection) {
				return func.call(context, value, index, collection);
			};
			//用于_.reduce函数中。
			case 4: return function (accumulator, value, index, collection) {
				return func.call(context, accumulator, value, index, collection);
			};
		}
		//直接使用也可，但是call比apply更快，所以还是添加了switch中的内容。
		return function () {
			return func.apply(context, arguments);
		};
	};

	var builtinIteratee;

	// An internal function to generate callbacks that can be applied to each
	// element in a collection, returning the desired result — either `identity`,
	// an arbitrary callback, a property matcher, or a property accessor.
	//这是一个回调生成器，在144行开始使用。
	var cb = function (value, context, argCount) {
		if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);
		if (value == null) return _.identity;
		if (_.isFunction(value)) return optimizeCb(value, context, argCount);
		if (_.isObject(value) && !_.isArray(value)) return _.matcher(value);
		return _.property(value);
	};

	// External wrapper for our callback generator. Users may customize
	// `_.iteratee` if they want additional predicate/iteratee shorthand styles.
	// This abstraction hides the internal-only argCount argument.
	//回调生成器的外部包装。
	_.iteratee = builtinIteratee = function (value, context) {
		return cb(value, context, Infinity);
	};

	// Similar to ES6's rest param (http://ariya.ofilabs.com/2013/03/es6-and-rest-parameter.html)
	// This accumulates the arguments passed into an array, after a given index.

	//restArgs用于把func的位于startIndex之后的参数归类为一个数组，
	//然后返回一个函数把这个数组结合startIndex之前的参数传递给func调用。
	var restArgs = function (func, startIndex) {
		//function.length表示function定义时，形式参数的个数。
		//注意此处是func.length，即传入的方法参数的形参个数而不是当前函数的参数个数，需要结合具体传入的参数来看。
		//当startIndex参数未传递时，默认func函数的最后一个参数开始为多余参数，会被整合到数组中。
		startIndex = startIndex == null ? func.length - 1 : +startIndex;
		return function () {
			//length表示构造的多余参数数组的长度，是实际的多余参数或者0。
			var length = Math.max(arguments.length - startIndex, 0),
				rest = Array(length),
				index = 0;
			//新建了一个rest数组，把位于startIndex索引之后的所有参数放入该数组。
			for (; index < length; index++) {
				rest[index] = arguments[index + startIndex];
			}
			//将多余参数放入rest数组之后，直接用Function.prototype.call执行函数。
			switch (startIndex) {
				case 0: return func.call(this, rest);
				case 1: return func.call(this, arguments[0], rest);
				case 2: return func.call(this, arguments[0], arguments[1], rest);
			}
			//如果startIndex > 2，那么使用apply传递数组作为参数的方式执行func。
			//虽然调用方法发生了变化，但是还是会把rest数组放在传入的参数数组的最后。
			//这样做其实与之前的方法无异（switch部分可以删除），但是call的效率高于apply。
			
			//args数组用于盛放startIndex之前的非多余参数。
			var args = Array(startIndex + 1);
			for (index = 0; index < startIndex; index++) {
				args[index] = arguments[index];
			}
			args[startIndex] = rest;
			return func.apply(this, args);
		};
	};

	// An internal function for creating a new object that inherits from another.
	//用于创建继承指定原型的对象。
	var baseCreate = function (prototype) {
		//如果传递的原型参数不是一个对象，那么返回一个空白对象，即不继承任何原型。
		if (!_.isObject(prototype)) return {};
		//nativeCreate = Object.create
		//Object.create(proto[, propertiesObject])，第一个参数是要继承的原型对象，第二个参数是要添加的新属性。
		//如果支持Object.create函数，那么直接用该函数创建对象。
		if (nativeCreate) return nativeCreate(prototype);
		//如果不支持Object.create方法，那么就手动创建。
		//Ctor = function(){}，一个空白函数。
		Ctor.prototype = prototype;
		var result = new Ctor;
		Ctor.prototype = null;
		return result;
	};

	var shallowProperty = function (key) {
		//闭包
		//该函数返回一个新的函数，用于获取指定对象的指定属性。
		return function (obj) {
			return obj == null ? void 0 : obj[key];
		};
	};

	//path是一个数组，数组中的项依次是某个对象的属性的具体路径，该方法用于获取指定的深层次的属性值。
	//比如如果deepGet(persons, ['person','name'])，则表示获取persons.person.name。
	var deepGet = function (obj, path) {
		var length = path.length;
		for (var i = 0; i < length; i++) {
			if (obj == null) return void 0;
			obj = obj[path[i]];
		}
		return length ? obj : void 0;
	};

	// Helper for collection methods to determine whether a collection
	// should be iterated as an array or as an object.
	// Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
	// Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
	var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
	var getLength = shallowProperty('length');
	//判断给定集合参数是否是类数组对象。
	//类数组对象：具有length属性并且length长度位于0~4294967296之间的对象。
	//参考冴羽大牛的博客：https://github.com/mqyqingfeng/Blog/issues/14
	var isArrayLike = function (collection) {
		var length = getLength(collection);
		return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
	};

	// Collection Functions
	// --------------------

	// The cornerstone, an `each` implementation, aka `forEach`.
	// Handles raw objects in addition to array-likes. Treats all
	// sparse array-likes as if they were dense.
	_.each = _.forEach = function (obj, iteratee, context) {
		//调用optimizeCb创建一个新的迭代函数，在context不为undefined时，在context上下文中调用传入的迭代器。
		iteratee = optimizeCb(iteratee, context);
		var i, length;
		//如果是类数组对象，那么通过obj[index]来访问对应属性。
		if (isArrayLike(obj)) {
			for (i = 0, length = obj.length; i < length; i++) {
				iteratee(obj[i], i, obj);
			}
		} else {
			//非类数组对象，通过obj[property]来访问对象属性。
			var keys = _.keys(obj);
			for (i = 0, length = keys.length; i < length; i++) {
				iteratee(obj[keys[i]], keys[i], obj);
			}
		}
		return obj;
	};

	// Return the results of applying the iteratee to each element.
	_.map = _.collect = function (obj, iteratee, context) {
		//创建新的迭代函数，在context上下文中调用迭代器。
		iteratee = cb(iteratee, context);
		//非类数组对象就构造一个keys数组，通过该数组可以把非类数组对象映射为类数组对象。
		//这里写的十分巧妙。
		var keys = !isArrayLike(obj) && _.keys(obj),
			length = (keys || obj).length,
			results = Array(length);
		for (var index = 0; index < length; index++) {
			var currentKey = keys ? keys[index] : index;
			results[index] = iteratee(obj[currentKey], currentKey, obj);
		}
		return results;
	};

	// Create a reducing function iterating left or right.
	//该函数用于创建一个新的函数，新的函数可以把指定集合的值叠加起来。
	//dir<0时从右往左叠加，dir>0时从左往右叠加。
	//实际上dir还是每次迭代时索引的变化量，当dir=-1时，每次索引减小1，反之亦然。
	var createReduce = function (dir) {
		// Wrap code that reassigns argument variables in a separate function than
		// the one that accesses `arguments.length` to avoid a perf hit. (#1991)
		//针对不同的dir，会定制不同的reducer函数。
		//reducer函数用于叠加list中的所有元素。
		var reducer = function (obj, iteratee, memo, initial) {
			var keys = !isArrayLike(obj) && _.keys(obj),
				length = (keys || obj).length,
				index = dir > 0 ? 0 : length - 1;
			//当_.reduce函数只接受到了两个参数，即未指定memo初值时，
			//手动为memo指定初值。
			if (!initial) {
				memo = obj[keys ? keys[index] : index];
				index += dir;
			}
			for (; index >= 0 && index < length; index += dir) {
				var currentKey = keys ? keys[index] : index;
				//循环迭代list中的每一个值，将每次迭代后迭代函数返回的值作为新的初值，以达到连接所有list元素的目的。
				memo = iteratee(memo, obj[currentKey], currentKey, obj);
			}
			return memo;
		};

		//闭包，使得外部函数能够访问内部私有的reducer函数。
		return function (obj, iteratee, memo, context) {
			//判断是否已经指定memo初值。
			var initial = arguments.length >= 3;
			return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
		};
	};

	// **Reduce** builds up a single result from a list of values, aka `inject`,
	// or `foldl`.
  /*
  _.reduce(list, iteratee, [memo], [context]) 
  reduce方法把list中元素归结为一个单独的数值。
  Memo是reduce函数的初始值，reduce的每一步都需要由iteratee返回。
  这个迭代传递4个参数：memo, value 和 迭代的index（或者 key）和最后一个引用的整个 list。 
  */
	_.reduce = _.foldl = _.inject = createReduce(1);

	// The right-associative version of reduce, also known as `foldr`.
  /*
  _.reduceRight(list, iteratee, memo, [context])
  reducRight是从右侧开始组合的元素的reduce函数，
  如果存在JavaScript 1.8版本的reduceRight，则用其代替。
  Foldr在javascript中不像其它有懒计算的语言那么有用（注：lazy evaluation：一种求值策略，
  只有当表达式的值真正需要时才对表达式进行计算）。
  */
	_.reduceRight = _.foldr = createReduce(-1);

	// Return the first value which passes a truth test. Aliased as `detect`.
	//在数组或者对象中查找使predicate返回true的匹配项。
	_.find = _.detect = function (obj, predicate, context) {
		var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
		var key = keyFinder(obj, predicate, context);
		if (key !== void 0 && key !== -1) return obj[key];
	};

	// Return all the elements that pass a truth test.
	// Aliased as `select`.
	_.filter = _.select = function (obj, predicate, context) {
		var results = [];
		predicate = cb(predicate, context);
		//利用已经写好的_.each函数遍历集合，然后把迭代器换为要执行的predicate。
		_.each(obj, function (value, index, list) {
			if (predicate(value, index, list)) results.push(value);
		});
		return results;
	};

	// Return all the elements for which a truth test fails.
	//返回所有使predicate函数返回false的匹配项。
	//利用已经写好的_.filter函数。
	_.reject = function (obj, predicate, context) {
		//_.negate返回一个针对predicate取反的函数。
		return _.filter(obj, _.negate(cb(predicate)), context);
	};

	// Determine whether all of the elements match a truth test.
	//检测是否所有集合元素都可以满足predicate函数，使其返回值为true。
	// Aliased as `all`.
	_.every = _.all = function (obj, predicate, context) {
		predicate = cb(predicate, context);
		var keys = !isArrayLike(obj) && _.keys(obj),
			length = (keys || obj).length;
		for (var index = 0; index < length; index++) {
			var currentKey = keys ? keys[index] : index;
			//一旦不满足就返回false，退出当前函数。
			if (!predicate(obj[currentKey], currentKey, obj)) return false;
		}
		//全部通过检测，返回true。
		return true;
	};

	// Determine if at least one element in the object matches a truth test.
	//检测是否有至少一个集合元素可以通过predicate检测。
	// Aliased as `any`.
	_.some = _.any = function (obj, predicate, context) {
		predicate = cb(predicate, context);
		var keys = !isArrayLike(obj) && _.keys(obj),
			length = (keys || obj).length;
		for (var index = 0; index < length; index++) {
			var currentKey = keys ? keys[index] : index;
			if (predicate(obj[currentKey], currentKey, obj)) return true;
		}
		return false;
	};

	// Determine if the array or object contains a given item (using `===`).
	// Aliased as `includes` and `include`.
  /*
  _.contains(list, value)
  如果list包含指定的value则返回true（注：使用===检测）。
  如果list 是数组，内部使用indexOf判断。
  */
	_.contains = _.includes = _.include = function (obj, item, fromIndex, guard) {
		//如果obj不是类数组对象（即为一个纯对象），那么将对象的值映射到一个新的数组中。
		if (!isArrayLike(obj)) obj = _.values(obj);
		if (typeof fromIndex != 'number' || guard) fromIndex = 0;
		return _.indexOf(obj, item, fromIndex) >= 0;
	};

	// Invoke a method (with arguments) on every item in a collection.
  /*
  _.invoke(list, methodName, *arguments) 
  在list的每个元素上执行methodName方法。 
  任何传递给invoke的额外参数，invoke都会在调用methodName方法的时候传递给它。
  根据API手册，methodName可以是一个具体的函数，也可以是指定list对象自身方法的路径的字符串，
  比如_.invoke([[5, 1, 7], [3, 2, 1]], 'sort');methodName指定的就是Array.prototype.sort方法。
  */
	//结合restArgs函数的功能，我们可以认为是把下面函数args之后的所有参数归入一个数组(即为args)，
	//然后在给下面的函数调用。
	_.invoke = restArgs(function (obj, path, args) {
		var contextPath, func;
		//如果path是一个具体的方法，那么直接赋值给func。
		if (_.isFunction(path)) {
			func = path;
		} else if (_.isArray(path)) {  //如果path是一个数组对象。
			//如果是字符串这里不会执行，因为字符串无法通过_.isArray检测。
			//那么contextPath = undefined， path仍然等于传入的参数。
			contextPath = path.slice(0, -1);  //-1表示从数组尾部开始算起。
			path = path[path.length - 1];
		}
		//针对obj中的每一个元素，调用迭代器，最后返回的结果（如果method不存在则返回null）
		//会存入数组，由map函数返回该数组。
		return _.map(obj, function (context) {
			var method = func;
			if (!method) {
				//如果传入的path是数组对象，那么使用deepGet方法提取数组中路径对应的属性值，且重新赋值给context。
				if (contextPath && contextPath.length) {
					context = deepGet(context, contextPath);
				}
				if (context == null) return void 0;
				//如果传入的path是一个字符串，那么直接通过context访问对应的方法。
				method = context[path];
			}
			//将args数组中包含的参数传递给method调用。
			return method == null ? method : method.apply(context, args);
		});
	});

	// Convenience version of a common use case of `map`: fetching a property.
	//循环遍历一边obj中的元素，然后针对每个元素，
	//调用一个属性获取器来获取对应属性的值，最后返回一个数组集合。
	//_.property(key)返回一个属性获取器。
  /*
  var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
  _.pluck(stooges, 'name');
  输出 ["moe", "larry", "curly"]
  */
	_.pluck = function (obj, key) {
		return _.map(obj, _.property(key));
	};

	// Convenience version of a common use case of `filter`: selecting only objects
	// containing specific `key:value` pairs.
	//锚点——下次继续——2018.02.28。
	_.where = function (obj, attrs) {
		return _.filter(obj, _.matcher(attrs));
	};

	// Convenience version of a common use case of `find`: getting the first object
	// containing specific `key:value` pairs.
	_.findWhere = function (obj, attrs) {
		return _.find(obj, _.matcher(attrs));
	};

	// Return the maximum element (or element-based computation).
	_.max = function (obj, iteratee, context) {
		var result = -Infinity, lastComputed = -Infinity,
			value, computed;
		if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
			obj = isArrayLike(obj) ? obj : _.values(obj);
			for (var i = 0, length = obj.length; i < length; i++) {
				value = obj[i];
				if (value != null && value > result) {
					result = value;
				}
			}
		} else {
			iteratee = cb(iteratee, context);
			_.each(obj, function (v, index, list) {
				computed = iteratee(v, index, list);
				if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
					result = v;
					lastComputed = computed;
				}
			});
		}
		return result;
	};

	// Return the minimum element (or element-based computation).
	_.min = function (obj, iteratee, context) {
		var result = Infinity, lastComputed = Infinity,
			value, computed;
		if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
			obj = isArrayLike(obj) ? obj : _.values(obj);
			for (var i = 0, length = obj.length; i < length; i++) {
				value = obj[i];
				if (value != null && value < result) {
					result = value;
				}
			}
		} else {
			iteratee = cb(iteratee, context);
			_.each(obj, function (v, index, list) {
				computed = iteratee(v, index, list);
				if (computed < lastComputed || computed === Infinity && result === Infinity) {
					result = v;
					lastComputed = computed;
				}
			});
		}
		return result;
	};

	// Shuffle a collection.
	_.shuffle = function (obj) {
		return _.sample(obj, Infinity);
	};

	// Sample **n** random values from a collection using the modern version of the
	// [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
	// If **n** is not specified, returns a single random element.
	// The internal `guard` argument allows it to work with `map`.
	_.sample = function (obj, n, guard) {
		if (n == null || guard) {
			if (!isArrayLike(obj)) obj = _.values(obj);
			return obj[_.random(obj.length - 1)];
		}
		var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
		var length = getLength(sample);
		n = Math.max(Math.min(n, length), 0);
		var last = length - 1;
		for (var index = 0; index < n; index++) {
			var rand = _.random(index, last);
			var temp = sample[index];
			sample[index] = sample[rand];
			sample[rand] = temp;
		}
		return sample.slice(0, n);
	};

	// Sort the object's values by a criterion produced by an iteratee.
	_.sortBy = function (obj, iteratee, context) {
		var index = 0;
		iteratee = cb(iteratee, context);
		return _.pluck(_.map(obj, function (value, key, list) {
			return {
				value: value,
				index: index++,
				criteria: iteratee(value, key, list)
			};
		}).sort(function (left, right) {
			var a = left.criteria;
			var b = right.criteria;
			if (a !== b) {
				if (a > b || a === void 0) return 1;
				if (a < b || b === void 0) return -1;
			}
			return left.index - right.index;
		}), 'value');
	};

	// An internal function used for aggregate "group by" operations.
	var group = function (behavior, partition) {
		return function (obj, iteratee, context) {
			var result = partition ? [[], []] : {};
			iteratee = cb(iteratee, context);
			_.each(obj, function (value, index) {
				var key = iteratee(value, index, obj);
				behavior(result, value, key);
			});
			return result;
		};
	};

	// Groups the object's values by a criterion. Pass either a string attribute
	// to group by, or a function that returns the criterion.
	_.groupBy = group(function (result, value, key) {
		if (_.has(result, key)) result[key].push(value); else result[key] = [value];
	});

	// Indexes the object's values by a criterion, similar to `groupBy`, but for
	// when you know that your index values will be unique.
	_.indexBy = group(function (result, value, key) {
		result[key] = value;
	});

	// Counts instances of an object that group by a certain criterion. Pass
	// either a string attribute to count by, or a function that returns the
	// criterion.
	_.countBy = group(function (result, value, key) {
		if (_.has(result, key)) result[key]++; else result[key] = 1;
	});

	var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
	// Safely create a real, live array from anything iterable.
	_.toArray = function (obj) {
		if (!obj) return [];
		if (_.isArray(obj)) return slice.call(obj);
		if (_.isString(obj)) {
			// Keep surrogate pair characters together
			return obj.match(reStrSymbol);
		}
		if (isArrayLike(obj)) return _.map(obj, _.identity);
		return _.values(obj);
	};

	// Return the number of elements in an object.
	_.size = function (obj) {
		if (obj == null) return 0;
		return isArrayLike(obj) ? obj.length : _.keys(obj).length;
	};

	// Split a collection into two arrays: one whose elements all satisfy the given
	// predicate, and one whose elements all do not satisfy the predicate.
	_.partition = group(function (result, value, pass) {
		result[pass ? 0 : 1].push(value);
	}, true);

	// Array Functions
	// ---------------

	// Get the first element of an array. Passing **n** will return the first N
	// values in the array. Aliased as `head` and `take`. The **guard** check
	// allows it to work with `_.map`.
	_.first = _.head = _.take = function (array, n, guard) {
		if (array == null || array.length < 1) return void 0;
		if (n == null || guard) return array[0];
		return _.initial(array, array.length - n);
	};

	// Returns everything but the last entry of the array. Especially useful on
	// the arguments object. Passing **n** will return all the values in
	// the array, excluding the last N.
	_.initial = function (array, n, guard) {
		return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
	};

	// Get the last element of an array. Passing **n** will return the last N
	// values in the array.
	_.last = function (array, n, guard) {
		if (array == null || array.length < 1) return void 0;
		if (n == null || guard) return array[array.length - 1];
		return _.rest(array, Math.max(0, array.length - n));
	};

	// Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
	// Especially useful on the arguments object. Passing an **n** will return
	// the rest N values in the array.
	_.rest = _.tail = _.drop = function (array, n, guard) {
		return slice.call(array, n == null || guard ? 1 : n);
	};

	// Trim out all falsy values from an array.
	// 该函数用于去掉数组中所有的false值，包括null、undefined、0、‘’、NaN等等。
	// 使用_.filter方法，传入Boolean函数作为判断函数，如果能够通过Boolean强制转换为bool值true，那么就保存到数组中。
	// 处理方法十分巧妙。
	_.compact = function (array) {
		return _.filter(array, Boolean);
	};

	// Internal implementation of a recursive `flatten` function.
	//用于展开一个数组或者类数组对象。
	var flatten = function (input, shallow, strict, output) {
		output = output || [];
		var idx = output.length;
		//遍历input参数。
		for (var i = 0, length = getLength(input); i < length; i++) {
			var value = input[i];
			if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
				// Flatten current level of array or arguments object.
				//如果input数组的元素是数组或者类数组对象，根据是否shallow来展开，如果shallow为true，那么只展开一级。
				if (shallow) {
					var j = 0, len = value.length;
					while (j < len) output[idx++] = value[j++];
				} else {
					//如果shallow为false，那么递归展开所有层级。
					flatten(value, shallow, strict, output);
					idx = output.length;
				}
			} else if (!strict) {
				//如果value不是数组或类数组对象，并且strict为false。
				//那么直接将value添加到输出数组，否则忽略value。
				output[idx++] = value;
			}
		}
		return output;
	};

	// Flatten out an array, either recursively (by default), or just one level.
	_.flatten = function (array, shallow) {
		return flatten(array, shallow, false);
	};

	// Return a version of the array that does not contain the specified value(s).
	// 去除数组中的指定值，通过restArgs将第二个参数开始的所有参数放到一个数组中去作为第二个参数。
	// 再利用_.difference函数求差集，返回的数组即为所求。
	_.without = restArgs(function (array, otherArrays) {
		return _.difference(array, otherArrays);
	});

	// Produce a duplicate-free version of the array. If the array has already
	// been sorted, you have the option of using a faster algorithm.
	// The faster algorithm will not work with an iteratee if the iteratee
	// is not a one-to-one function, so providing an iteratee will disable
	// the faster algorithm.
	// Aliased as `unique`.
	//数组去重函数，使得数组中的每一项都是独一无二的。
	_.uniq = _.unique = function (array, isSorted, iteratee, context) {
		//如果没有传递isSorted参数（即传递值不是Boolean类型），那么默认为false，其余参数重新赋值。
		if (!_.isBoolean(isSorted)) {
			context = iteratee;
			iteratee = isSorted;
			isSorted = false;
		}
		//如果传递了iteratee，那么使用cb方法包装（确保返回一个函数），然后重新赋值。
		if (iteratee != null) iteratee = cb(iteratee, context);
		//保存结果。
		var result = [];
		//用于存放array的值便于下一次比较，或者用于存储computed值。
		var seen = [];
		//遍历array数组。
		for (var i = 0, length = getLength(array); i < length; i++) {
			//value表示当前项，computed表示要比较的项（有iteratee时是iteratee的返回值，无iteratee时是value自身）。
			var value = array[i],
				computed = iteratee ? iteratee(value, i, array) : value;
			if (isSorted && !iteratee) {
				//如果数组是有序的，并且没有传递iteratee，则依次比较相邻的两项是否相等。
				//！0===true，其余皆为false。
				if (!i || seen !== computed) result.push(value);
				//seen存放当前的项，以便于下一次比较。
				seen = computed;
			} else if (iteratee) {
				//如果传递了iteratee，那么seen就用于存放computed值，便于比较。
				//之所以不直接使用result存放computed值是因为computed只用于比较，result存放的值必须是原来数组中的值。
				if (!_.contains(seen, computed)) {
					seen.push(computed);
					result.push(value);
				}
			} else if (!_.contains(result, value)) {
				//isSorted为false并且iteratee为undefined。
				//可以理解为参数数组中是乱序数字，直接比较就好了。
				result.push(value);
			}
		}
		return result;
	};

	// Produce an array that contains the union: each distinct element from all of
	// the passed-in arrays.
	//数组求并集函数。
	_.union = restArgs(function (arrays) {
		return _.uniq(flatten(arrays, true, true));
	});

	// Produce an array that contains every item shared between all the
	// passed-in arrays.
	//获取传入的多个数组的交集，之所以只有一个形参，是因为该函数使用第一个数组参数作为基准。
	_.intersection = function (array) {
		//将要返回的结果数组。
		var result = [];
		//传入数组的个数。
		var argsLength = arguments.length;
		//遍历第一个数组参数。
		for (var i = 0, length = getLength(array); i < length; i++) {
			//当前项。
			var item = array[i];
			//如果结果数组中已有该项，那么直接跳过当前循环，进入下一轮循环中。
			if (_.contains(result, item)) continue;
			var j;
			//从第二个参数开始，遍历每一个参数。
			for (j = 1; j < argsLength; j++) {
				//一旦有一个参数数组不包含item，就退出循环。
				if (!_.contains(arguments[j], item)) break;
			}
			//如果所有参数数组都包含item项，就把item放入result。
			if (j === argsLength) result.push(item);
		}
		return result;
	};

	// Take the difference between one array and a number of other arrays.
	// Only the elements present in just the first array will remain.
	//数组求差集函数。
	//通过restArgs函数把第二个数组开始的所有参数数组合并到一个数组。
	_.difference = restArgs(function (array, rest) {
		//使用flatten展开rest数组。
		rest = flatten(rest, true, true);
		//使用filter函数过滤array数组达到求差集的目的，判断条件就是value是否属于rest。
		return _.filter(array, function (value) {
			return !_.contains(rest, value);
		});
	});

	// Complement of _.zip. Unzip accepts an array of arrays and groups
	// each array's elements on shared indices.
	_.unzip = function (array) {
		var length = array && _.max(array, getLength).length || 0;
		var result = Array(length);

		for (var index = 0; index < length; index++) {
			result[index] = _.pluck(array, index);
		}
		return result;
	};

	// Zip together multiple lists into a single array -- elements that share
	// an index go together.
	_.zip = restArgs(_.unzip);

	// Converts lists into objects. Pass either a single array of `[key, value]`
	// pairs, or two parallel arrays of the same length -- one of keys, and one of
	// the corresponding values. Passing by pairs is the reverse of _.pairs.
	_.object = function (list, values) {
		var result = {};
		for (var i = 0, length = getLength(list); i < length; i++) {
			if (values) {
				result[list[i]] = values[i];
			} else {
				result[list[i][0]] = list[i][1];
			}
		}
		return result;
	};

	// Generator function to create the findIndex and findLastIndex functions.
	//创建索引查找器，当dir>0时，从左往右查找，当dir>0时，反向查找。
	var createPredicateIndexFinder = function (dir) {
		return function (array, predicate, context) {
			predicate = cb(predicate, context);
			var length = getLength(array);
			var index = dir > 0 ? 0 : length - 1;
			for (; index >= 0 && index < length; index += dir) {
				if (predicate(array[index], index, array)) return index;
			}
			//如果遍历数组之后仍未找到匹配项，则返回-1。
			return -1;
		};
	};

	// Returns the first index on an array-like that passes a predicate test.
	//正向查找。
	_.findIndex = createPredicateIndexFinder(1);
	//逆向查找。
	_.findLastIndex = createPredicateIndexFinder(-1);

	// Use a comparator function to figure out the smallest index at which
	// an object should be inserted so as to maintain order. Uses binary search.
	//使用二分法，查找一个合适的（最小的）索引来插入对象以维护顺序。
	_.sortedIndex = function (array, obj, iteratee, context) {
		//如果没有指定iteratee迭代器，那么cb会返回_.identity函数作为新的迭代器，
		//该函数输入值即为返回值。
		iteratee = cb(iteratee, context, 1);
		//如果没有指定iteratee，则实际上下面句子等于var value = obj;
		var value = iteratee(obj);
		var low = 0, high = getLength(array);
		while (low < high) {
			var mid = Math.floor((low + high) / 2);
			//如果没有传递iteratee参数，那么if中的语句实际上等价于array[mid] < value。
			if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
		}
		return low;
	};

	// Generator function to create the indexOf and lastIndexOf functions.
	//创建（正向或者反向）索引查找函数。
	var createIndexFinder = function (dir, predicateFind, sortedIndex) {
		//闭包。
		return function (array, item, idx) {
			var i = 0, length = getLength(array);
			//如果传入了idx参数（实际上是叫fromIndex），并且是一个number值。
			//此时idx为数字类型而非布尔类型，所以肯定不是有序数组，无法使用二分法加速查找。
			if (typeof idx == 'number') {
				if (dir > 0) {
					i = idx >= 0 ? idx : Math.max(idx + length, i);
				} else {
					length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
				}
			} else if (sortedIndex && idx && length) {
				//正向查找时，具有sortedIndex参数，反向查找时没有。
				//else if条件表明idx不是数字类型，如果此时idx为true，那么可以执行二分法快速查找。
				idx = sortedIndex(array, item);
				return array[idx] === item ? idx : -1;
			}
			//此处很重要，使用item!==item来排除item为NaN的情况，
			//因为NaN !== NaN的结果为true。
			if (item !== item) {
				idx = predicateFind(slice.call(array, i, length), _.isNaN);
				return idx >= 0 ? idx + i : -1;
			}
			//如果idx（即fromIndex）为undefined，执行下面片段。
			for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
				if (array[idx] === item) return idx;
			}
			return -1;
		};
	};

	// Return the position of the first occurrence of an item in an array,
	// or -1 if the item is not included in the array.
	// If the array is large and already in sort order, pass `true`
	// for **isSorted** to use binary search.
  /*
  _.indexOf(array, value, [isSorted]) 
  返回value在该 array 中的索引值，如果value不存在 array中就返回-1。
  使用原生的indexOf 函数，除非它失效。如果您正在使用一个大数组，你知道数组已经排序，
  传递true给isSorted将更快的用二进制搜索..,或者，传递一个数字作为第三个参数，
  为了在给定的索引的数组中寻找第一个匹配值。
  */
	_.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
	_.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

	// Generate an integer Array containing an arithmetic progression. A port of
	// the native Python `range()` function. See
	// [the Python documentation](http://docs.python.org/library/functions.html#range).
	_.range = function (start, stop, step) {
		if (stop == null) {
			stop = start || 0;
			start = 0;
		}
		if (!step) {
			step = stop < start ? -1 : 1;
		}

		var length = Math.max(Math.ceil((stop - start) / step), 0);
		var range = Array(length);

		for (var idx = 0; idx < length; idx++ , start += step) {
			range[idx] = start;
		}

		return range;
	};

	// Split an **array** into several arrays containing **count** or less elements
	// of initial array.
	_.chunk = function (array, count) {
		if (count == null || count < 1) return [];

		var result = [];
		var i = 0, length = array.length;
		while (i < length) {
			result.push(slice.call(array, i, i += count));
		}
		return result;
	};

	// Function (ahem) Functions
	// ------------------

	// Determines whether to execute a function as a constructor
	// or a normal function with the provided arguments.
	//执行绑定函数，决定是否把一个函数作为构造函数或者普通函数调用。
	var executeBound = function (sourceFunc, boundFunc, context, callingContext, args) {
		//如果callingContext不是boundFunc的一个实例，则把sourceFunc作为普通函数调用。
		if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
		//否则把sourceFunc作为构造函数调用。
		var self = baseCreate(sourceFunc.prototype);
		var result = sourceFunc.apply(self, args);
		if (_.isObject(result)) return result;
		return self;
	};

	// Create a function bound to a given object (assigning `this`, and arguments,
	// optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
	// available.
	//将指定函数中的this绑定到指定上下文中，并传递一些参数作为默认参数。
	_.bind = restArgs(function (func, context, args) {
		if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
		var bound = restArgs(function (callArgs) {
			//等同于func.apply(context, args.concat(callArgs))。
			return executeBound(func, bound, context, this, args.concat(callArgs));
		});
		return bound;
	});

	// Partially apply a function by creating a version that has had some of its
	// arguments pre-filled, without changing its dynamic `this` context. _ acts
	// as a placeholder by default, allowing any combination of arguments to be
	// pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
	//使用restArgs进行处理，把传给partial的多余参数整合到boundArgs数组，然后再交给匿名函数处理。
	_.partial = restArgs(function (func, boundArgs) {
		//默认占位符为_，下划线。
		var placeholder = _.partial.placeholder;
		var bound = function () {
			//该函数接受的参数是用于替代boundArgs中占位符的具体参数。
			var position = 0, length = boundArgs.length;
			var args = Array(length);
			//遍历boundArgs数组，如果数组中有占位符，则用bound所接受的参数按顺序依次替代。
			for (var i = 0; i < length; i++) {
				args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
			}
			//当position小于bound函数的参数个数时，说明bound函数还接受了多余的参数，也放入args数组。
			while (position < arguments.length) args.push(arguments[position++]);
			//此处相当于：
			//return func.apply(this, args);
			return executeBound(func, bound, this, this, args);
		};
		return bound;
	});

	//默认的_.partial的占位符，可以手动修改，注意是变量_，不是字符串“_”。
	_.partial.placeholder = _;

	// Bind a number of an object's methods to that object. Remaining arguments
	// are the method names to be bound. Useful for ensuring that all callbacks
	// defined on an object belong to it.
	//将obj对象中的方法的this指向obj，防止在传递函数时，函数的this丢失指向。
	_.bindAll = restArgs(function (obj, keys) {
		//传递的keys是一个函数名称（字符串）数组，而且有可能存在嵌套，那么使用flatten函数进行展开。
		keys = flatten(keys, false, false);
		var index = keys.length;
		if (index < 1) throw new Error('bindAll must be passed function names');
		//遍历keys数组。
		while (index--) {
			var key = keys[index];
			//给obj的key属性重新赋值，新函数覆盖之前的函数。
			obj[key] = _.bind(obj[key], obj);
		}
	});

	// Memoize an expensive function by storing its results.
	//_.memoize可以缓存func的运算结果，hasher是一个生成hash值的函数。
	_.memoize = function (func, hasher) {
		//闭包。
		var memoize = function (key) {
			var cache = memoize.cache;
			//address等于hasher的返回值或者key（默认）。
			var address = '' + (hasher ? hasher.apply(this, arguments) : key);
			//如果cache没有address值属性（之前未被执行过），那么缓存此次执行结果。
			if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
			//最后还是返回执行结果。
			return cache[address];
		};
		memoize.cache = {};
		return memoize;
	};

	// Delays a function for the given number of milliseconds, and then calls
	// it with the arguments supplied.
	//延时函数，在wait毫秒之后调用func，并且将args数组中的元素作为参数传递给func。
	//延时函数最后会返回TimeoutID。
	_.delay = restArgs(function (func, wait, args) {
		return setTimeout(function () {
			return func.apply(null, args);
		}, wait);
	});

	// Defers a function, scheduling it to run after the current call stack has
	// cleared.
	_.defer = _.partial(_.delay, _, 1);

	// Returns a function, that, when invoked, will only be triggered at most once
	// during a given window of time. Normally, the throttled function will run
	// as much as it can, without ever going more than once per `wait` duration;
	// but if you'd like to disable the execution on the leading edge, pass
	// `{leading: false}`. To disable execution on the trailing edge, ditto.
	_.throttle = function (func, wait, options) {
		var timeout, context, args, result;
		var previous = 0;
		if (!options) options = {};

		var later = function () {
			//previous===0时，下一次会立即触发。
			//previous===_.now()时，下一次不会立即触发。
			previous = options.leading === false ? 0 : _.now();
			timeout = null;
			result = func.apply(context, args);
			if (!timeout) context = args = null;
		};

		var throttled = function () {
			//获取当前时间戳（13位milliseconds表示）。
			//每一次调用throttled函数，都会重新获取now，计算时间差。
			//而previous只有在func函数被执行过后才回重新赋值。
			//也就是说，每次计算的remaining时间间隔都是每次调用throttled函数与上一次执行func之间的时间差。
			var now = _.now();
			//!previous确保了在第一次调用时才会满足条件。
			//leading为false表示不立即执行。
			//注意是全等号，只有在传递了options参数时，比较才有意义。
			if (!previous && options.leading === false) previous = now;
			//计算剩余时间，now-previous为已消耗时间。
			var remaining = wait - (now - previous);
			context = this;
			args = arguments;
			//remaining <= 0代表当前时间超过了wait时长。
			//remaining > wait代表now < previous，这种情况是不存在的，因为now >= previous是永远成立的(除非主机时间已经被修改过)。
			//此处就相当于只判断了remaining <= 0是否成立。
			if (remaining <= 0 || remaining > wait) {
				//防止出现remaining <= 0但是设置的timeout仍然未触发的情况。
				if (timeout) {
					clearTimeout(timeout);
					timeout = null;
				}
				//将要执行func函数，重新设置previous的值，开始下一轮计时。
				previous = now;
				//时间达到间隔为wait的要求，立即传入参数执行func函数。
				result = func.apply(context, args);
				if (!timeout) context = args = null;
				//remaining>0&&remaining<=wait、不忽略最后一个输出、
				//timeout未被设置时，延时调用later并设置timeout。
				//如果设置trailing===false，那么直接跳过延时调用later的部分。
			} else if (!timeout && options.trailing !== false) {
				timeout = setTimeout(later, remaining);
			}
			return result;
		};

		throttled.cancel = function () {
			clearTimeout(timeout);
			previous = 0;
			timeout = context = args = null;
		};

		return throttled;
	};

	// Returns a function, that, as long as it continues to be invoked, will not
	// be triggered. The function will be called after it stops being called for
	// N milliseconds. If `immediate` is passed, trigger the function on the
	// leading edge, instead of the trailing.
	//去抖函数，传入的函数在wait时间之后执行，并且只会被执行一次。
	//如果immediate传递为true，那么在函数被传递时就立即调用。
	//实现原理：设计到异步JavaScript，多次调用_.debounce返回的函数，会一次性执行完，但是每次调用
	//该函数又会清空上一次的TimeoutID，所以实际上只执行了最后一个setTimeout的内容。
	_.debounce = function (func, wait, immediate) {
		var timeout, result;

		var later = function (context, args) {
			//每次调用later都会导致timeout清空，清空timeout才能在immediate为true时callNow也为true。
			timeout = null;
			//如果没有传递args参数，那么func不执行。
			if (args) result = func.apply(context, args);
		};

		//被返回的函数，该函数只会被调用一次。
		var debounced = restArgs(function (args) {
			//这行代码的作用是清除上一次的TimeoutID，
			//使得如果有多次调用该函数的场景时，只执行最后一次调用的延时。
			if (timeout) clearTimeout(timeout);
			if (immediate) {
				////如果传递了immediate并且timeout为空，那么就立即调用func，否则不立即调用。
				var callNow = !timeout;
				//下面这行代码，later函数内部的func函数注定不会被执行，因为没有给later传递参数。
				//它的作用是确保返回了一个timeout。
				timeout = setTimeout(later, wait);
				if (callNow) result = func.apply(this, args);
			} else {
				//如果没有传递immediate，那么就使用_.delay函数延时执行later。
				timeout = _.delay(later, wait, this, args);
			}

			return result;
		});

		//该函数用于取消当前去抖效果。
		debounced.cancel = function () {
			clearTimeout(timeout);
			timeout = null;
		};

		return debounced;
	};

	// Returns the first function passed as an argument to the second,
	// allowing you to adjust arguments, run code before and after, and
	// conditionally execute the original function.
	_.wrap = function (func, wrapper) {
		return _.partial(wrapper, func);
	};

	// Returns a negated version of the passed-in predicate.
	//针对predicate函数，返回一个意义与其相反的函数。
	_.negate = function (predicate) {
		return function () {
			return !predicate.apply(this, arguments);
		};
	};

	// Returns a function that is the composition of a list of functions, each
	// consuming the return value of the function that follows.
	_.compose = function () {
		var args = arguments;
		var start = args.length - 1;
		return function () {
			var i = start;
			var result = args[start].apply(this, arguments);
			while (i--) result = args[i].call(this, result);
			return result;
		};
	};

	// Returns a function that will only be executed on and after the Nth call.
	//返回一个函数，只有在第times次执行时才会返回执行结果。
	_.after = function (times, func) {
		return function () {
			if (--times < 1) {
				return func.apply(this, arguments);
			}
		};
	};

	// Returns a function that will only be executed up to (but not including) the Nth call.
	//返回一个函数只能被执行times-1次，多余的执行会返回之前执行的结果。
	_.before = function (times, func) {
		//用于保存最后一次有效执行的结果。
		var memo;
		return function () {
			//如果超过了指定的执行次数，memo的值不会再变化。
			if (--times > 0) {
				//有效执行次数之内，返回正确的执行结果。
				memo = func.apply(this, arguments);
			}
			//如果执行次数耗尽，把func赋值为null，以便让GC回收。
			if (times <= 1) func = null;
			return memo;
		};
	};

	// Returns a function that will be executed at most one time, no matter how
	// often you call it. Useful for lazy initialization.
	//调用partial函数使指定函数最多只能执行一次，相当于是调用_.before(2, func);
	//_.once接受的参数，会附加到参数2后面传递给_.before函数调用。
	_.once = _.partial(_.before, 2);

	_.restArgs = restArgs;

	// Object Functions
	// ----------------

	// Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
	var hasEnumBug = !{ toString: null }.propertyIsEnumerable('toString');
	var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
		'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

	var collectNonEnumProps = function (obj, keys) {
		var nonEnumIdx = nonEnumerableProps.length;
		var constructor = obj.constructor;
		var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

		// Constructor is a special case.
		var prop = 'constructor';
		if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

		while (nonEnumIdx--) {
			prop = nonEnumerableProps[nonEnumIdx];
			if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
				keys.push(prop);
			}
		}
	};

	// Retrieve the names of an object's own properties.
	// Delegates to **ECMAScript 5**'s native `Object.keys`.
	//返回指定对象自身拥有的所有属性,不会返回原型链上的属性。
	_.keys = function (obj) {
		//非对象返回一个空数组。
		if (!_.isObject(obj)) return [];
		//nativeKeys = Object.keys
		//Object.keys()方法会返回一个由一个给定对象的自身可枚举属性组成的数组，
		//数组中属性名的排列顺序和使用 for...in 循环遍历该对象时返回的顺序一致
		//(两者的主要区别是 一个 for-in 循环还会枚举其原型链上的属性)。
		if (nativeKeys) return nativeKeys(obj);
		var keys = [];
		//使用if判断，剔除原型链上的属性。
		for (var key in obj) if (_.has(obj, key)) keys.push(key);
		// Ahem, IE < 9.
		//IE9之下的版本存在bug，需要特殊处理。
		if (hasEnumBug) collectNonEnumProps(obj, keys);
		return keys;
	};

	// Retrieve all the property names of an object.
	_.allKeys = function (obj) {
		if (!_.isObject(obj)) return [];
		var keys = [];
		for (var key in obj) keys.push(key);
		// Ahem, IE < 9.
		if (hasEnumBug) collectNonEnumProps(obj, keys);
		return keys;
	};

	// Retrieve the values of an object's properties.
	//将对象中所有的自身属性的值都放入到一个数组。
	_.values = function (obj) {
		var keys = _.keys(obj);
		var length = keys.length;
		var values = Array(length);
		for (var i = 0; i < length; i++) {
			values[i] = obj[keys[i]];
		}
		return values;
	};

	// Returns the results of applying the iteratee to each element of the object.
	// In contrast to _.map it returns an object.
	_.mapObject = function (obj, iteratee, context) {
		iteratee = cb(iteratee, context);
		var keys = _.keys(obj),
			length = keys.length,
			results = {};
		for (var index = 0; index < length; index++) {
			var currentKey = keys[index];
			results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
		}
		return results;
	};

	// Convert an object into a list of `[key, value]` pairs.
	// The opposite of _.object.
	_.pairs = function (obj) {
		var keys = _.keys(obj);
		var length = keys.length;
		var pairs = Array(length);
		for (var i = 0; i < length; i++) {
			pairs[i] = [keys[i], obj[keys[i]]];
		}
		return pairs;
	};

	// Invert the keys and values of an object. The values must be serializable.
	_.invert = function (obj) {
		var result = {};
		var keys = _.keys(obj);
		for (var i = 0, length = keys.length; i < length; i++) {
			result[obj[keys[i]]] = keys[i];
		}
		return result;
	};

	// Return a sorted list of the function names available on the object.
	// Aliased as `methods`.
	_.functions = _.methods = function (obj) {
		var names = [];
		for (var key in obj) {
			if (_.isFunction(obj[key])) names.push(key);
		}
		return names.sort();
	};

	// An internal function for creating assigner functions.
	var createAssigner = function (keysFunc, defaults) {
		return function (obj) {
			var length = arguments.length;
			if (defaults) obj = Object(obj);
			if (length < 2 || obj == null) return obj;
			for (var index = 1; index < length; index++) {
				var source = arguments[index],
					keys = keysFunc(source),
					l = keys.length;
				for (var i = 0; i < l; i++) {
					var key = keys[i];
					if (!defaults || obj[key] === void 0) obj[key] = source[key];
				}
			}
			return obj;
		};
	};

	// Extend a given object with all the properties in passed-in object(s).
	_.extend = createAssigner(_.allKeys);

	// Assigns a given object with all the own properties in the passed-in object(s).
	// (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
	_.extendOwn = _.assign = createAssigner(_.keys);

	// Returns the first key on an object that passes a predicate test.
	//查找对象中的匹配项，返回属性名。
	_.findKey = function (obj, predicate, context) {
		predicate = cb(predicate, context);
		var keys = _.keys(obj), key;
		for (var i = 0, length = keys.length; i < length; i++) {
			key = keys[i];
			if (predicate(obj[key], key, obj)) return key;
		}
	};

	// Internal pick helper function to determine if `obj` has key `key`.
	var keyInObj = function (value, key, obj) {
		return key in obj;
	};

	// Return a copy of the object only containing the whitelisted properties.
	_.pick = restArgs(function (obj, keys) {
		var result = {}, iteratee = keys[0];
		if (obj == null) return result;
		if (_.isFunction(iteratee)) {
			if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
			keys = _.allKeys(obj);
		} else {
			iteratee = keyInObj;
			keys = flatten(keys, false, false);
			obj = Object(obj);
		}
		for (var i = 0, length = keys.length; i < length; i++) {
			var key = keys[i];
			var value = obj[key];
			if (iteratee(value, key, obj)) result[key] = value;
		}
		return result;
	});

	// Return a copy of the object without the blacklisted properties.
	_.omit = restArgs(function (obj, keys) {
		var iteratee = keys[0], context;
		if (_.isFunction(iteratee)) {
			iteratee = _.negate(iteratee);
			if (keys.length > 1) context = keys[1];
		} else {
			keys = _.map(flatten(keys, false, false), String);
			iteratee = function (value, key) {
				return !_.contains(keys, key);
			};
		}
		return _.pick(obj, iteratee, context);
	});

	// Fill in a given object with default properties.
	_.defaults = createAssigner(_.allKeys, true);

	// Creates an object that inherits from the given prototype object.
	// If additional properties are provided then they will be added to the
	// created object.
	_.create = function (prototype, props) {
		var result = baseCreate(prototype);
		if (props) _.extendOwn(result, props);
		return result;
	};

	// Create a (shallow-cloned) duplicate of an object.
	_.clone = function (obj) {
		if (!_.isObject(obj)) return obj;
		return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
	};

	// Invokes interceptor with the obj, and then returns obj.
	// The primary purpose of this method is to "tap into" a method chain, in
	// order to perform operations on intermediate results within the chain.
	_.tap = function (obj, interceptor) {
		interceptor(obj);
		return obj;
	};

	// Returns whether an object has a given set of `key:value` pairs.
	_.isMatch = function (object, attrs) {
		var keys = _.keys(attrs), length = keys.length;
		if (object == null) return !length;
		var obj = Object(object);
		for (var i = 0; i < length; i++) {
			var key = keys[i];
			if (attrs[key] !== obj[key] || !(key in obj)) return false;
		}
		return true;
	};


	// Internal recursive comparison function for `isEqual`.
	var eq, deepEq;
	eq = function (a, b, aStack, bStack) {
		// Identical objects are equal. `0 === -0`, but they aren't identical.
		// See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
		//除了0 === -0这个特例之外，其余所有a === b的例子都代表它们相等。
		//应当判断0 !== -0，但是JavaScript中0 === -0。
		//下面这行代码就是为了解决这个问题。
		//当a !== 0或者1/a === 1/b时返回true，一旦a === 0并且1/a !== 1/b就返回false。
		//而a === 0且1/a !== 1/b就代表a，b有一个为0，有一个为-0。
		if (a === b) return a !== 0 || 1 / a === 1 / b;
		//一旦a、b不严格相等，就进入后续检测。
		//a == b成立但是a === b不成立的例子中需要排除null和undefined，其余例子需要后续判断。
		// `null` or `undefined` only equal to itself (strict comparison).
		//一旦a或者b中有一个为null就代表另一个为undefined，这种情况可以直接排除。
		if (a == null || b == null) return false;
		// `NaN`s are equivalent, but non-reflexive.
		//自身不等于自身的情况，一旦a，b都为NaN，则可以返回true。
		if (a !== a) return b !== b;
		// Exhaust primitive checks
		//如果a，b都不为JavaScript对象，那么经过以上监测之后还不严格相等的话就可以直接断定a不等于b。
		var type = typeof a;
		if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
		//如果a，b是JavaScript对象，还需要做后续深入的判断。
		return deepEq(a, b, aStack, bStack);
	};

	// Internal recursive comparison function for `isEqual`.
	//a、b为JavaScript对象的情况下，使用deepEq进行深入比较。
	deepEq = function (a, b, aStack, bStack) {
		// Unwrap any wrapped objects.
		//如果a，b是_的一个实例的话，需要先把他们解包出来再进行比较。
		if (a instanceof _) a = a._wrapped;
		if (b instanceof _) b = b._wrapped;
		// Compare `[[Class]]` names.
		//先根据a，b的Class字符串进行比较，如果两个对象的Class字符串都不一样，
		//那么直接可以认为两者不相等。
		var className = toString.call(a);
		if (className !== toString.call(b)) return false;
		//如果两者的Class字符串相等，再进一步进行比较。
		//优先检测内置对象之间的比较，非内置对象再往后检测。
		switch (className) {
			// Strings, numbers, regular expressions, dates, and booleans are compared by value.
			//如果a，b为正则表达式，那么转化为字符串判断是否相等即可。
			case '[object RegExp]':
			// RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
			case '[object String]':
				// Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
				// equivalent to `new String("5")`.
				//如果a， b是字符串对象，那么转化为字符串进行比较。因为一下两个变量：
				//var x = new String('12');
				//var y = new String('12');
				//x === y是false，x === y也是false，但是我们应该认为x与y是相等的。
				//所以我们需要将其转化为字符串进行比较。
				return '' + a === '' + b;
			case '[object Number]':
				//数字对象转化为数字进行比较，并且要考虑new Number(NaN) === new Number(NaN)应该要成立的情况。
				// `NaN`s are equivalent, but non-reflexive.
				// Object(NaN) is equivalent to NaN.
				if (+a !== +a) return +b !== +b;
				// An `egal` comparison is performed for other numeric values.
				//排除0 === -0 的情况。
				return +a === 0 ? 1 / +a === 1 / b : +a === +b;
			case '[object Date]':
			//Date类型以及Boolean类型都可以转换为number类型进行比较。
			//在变量前加一个加号“+”，可以强制转换为数值型。
			//在Date型变量前加一个加号“+”可以将Date转化为毫秒形式；Boolean类型同上（转换为0或者1）。
			case '[object Boolean]':
				// Coerce dates and booleans to numeric primitive values. Dates are compared by their
				// millisecond representations. Note that invalid dates with millisecond representations
				// of `NaN` are not equivalent.
				return +a === +b;
			case '[object Symbol]':
				return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
		}

		var areArrays = className === '[object Array]';
		//如果不是数组对象。
		if (!areArrays) {
			if (typeof a != 'object' || typeof b != 'object') return false;

			// Objects with different constructors are not equivalent, but `Object`s or `Array`s
			// from different frames are.
			//比较两个非数组对象的构造函数。
			var aCtor = a.constructor, bCtor = b.constructor;
			if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
				_.isFunction(bCtor) && bCtor instanceof bCtor)
				&& ('constructor' in a && 'constructor' in b)) {
				return false;
			}
		}
		// Assume equality for cyclic structures. The algorithm for detecting cyclic
		// structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

		// Initializing stack of traversed objects.
		// It's done here since we only need them for objects and arrays comparison.
		//初次调用eq函数时，aStack以及bStack均未被传递，在循环递归的时候，会被传递进来。
		//aStack和bStack存在的意义在于防止循环引用对象之间的比较。
		aStack = aStack || [];
		bStack = bStack || [];
		var length = aStack.length;
		
		while (length--) {
			// Linear search. Performance is inversely proportional to the number of
			// unique nested structures.
			if (aStack[length] === a) return bStack[length] === b;
		}

		// Add the first object to the stack of traversed objects.
		//初次调用eq函数时，就把两个参数放入到参数堆栈中去，保存起来方便递归调用时使用。
		aStack.push(a);
		bStack.push(b);

		// Recursively compare objects and arrays.
		//如果是数组对象。
		if (areArrays) {
			// Compare array lengths to determine if a deep comparison is necessary.
			length = a.length;
			//长度不等，直接返回false认定为数组不相等。
			if (length !== b.length) return false;
			// Deep compare the contents, ignoring non-numeric properties.
			while (length--) {
				//递归调用。
				if (!eq(a[length], b[length], aStack, bStack)) return false;
			}
		} else {
			// Deep compare objects.
			//对比纯对象。
			var keys = _.keys(a), key;
			length = keys.length;
			// Ensure that both objects contain the same number of properties before comparing deep equality.
			//对比属性数量，如果数量不等，直接返回false。
			if (_.keys(b).length !== length) return false;
			while (length--) {
				// Deep compare each member
				key = keys[length];
				if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
			}
		}
		// Remove the first object from the stack of traversed objects.
		//循环递归结束，把a，b堆栈中的元素推出。
		aStack.pop();
		bStack.pop();
		return true;
	};

	// Perform a deep comparison to check if two objects are equal.
	//该方法用于做出一些符合我们思维的相等判断。
	//比如NaN应该等于NaN、0应该不等于-0、{name:'xiaoming'}应该等于{name:'xiaoming'}。
	//该方法还会对复杂对象深入比较，一旦两者相同就可以认为两个对象相等。
	_.isEqual = function (a, b) {
		return eq(a, b);
	};

	// Is a given array, string, or object empty?
	// An "empty" object has no enumerable own-properties.
	//检测参数是否是空对象。
	_.isEmpty = function (obj) {
		if (obj == null) return true;
		//当参数是类数组对象或者数组对象时，一旦长度为零就可以认为是空对象。
		if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
		//常规对象根据其键的个数判断，没有键时即为空对象。
		return _.keys(obj).length === 0;
	};

	// Is a given value a DOM element?
	//传入的参数是否是一个DOM对象。
	_.isElement = function (obj) {
		//nodeType表示JavaScript中DOM对象的类型，1表示一个标签节点，9表示一个document对象节点。
		return !!(obj && obj.nodeType === 1);
	};

	// Is a given value an array?
	// Delegates to ECMA5's native Array.isArray
	//检测是否是一个数组对象，比检测类数组对象的isArrayLike方法更加严格。
	_.isArray = nativeIsArray || function (obj) {
		return toString.call(obj) === '[object Array]';
	};

	// Is a given variable an object?
	//判断传入的参数是否是一个非空对象。
	_.isObject = function (obj) {
		var type = typeof obj;
		return type === 'function' || type === 'object' && !!obj;
		//!!双感叹号的作用等同于Boolean函数。
		//之所以需要判断!!obj的值，是因为需要确保传入参数是非空对象。
		//!!null===false
	};

	// Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError, isMap, isWeakMap, isSet, isWeakSet.
	//添加一系列的类型判断函数：比如isArguments、isFunction、isString等等。
	//具体的方法是通过判断Object.prototype.toString方法来辨别其类型。
	_.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol', 'Map', 'WeakMap', 'Set', 'WeakSet'], function (name) {
		_['is' + name] = function (obj) {
			//相当于是：
			//return Object.prototype.toString.call(obj) === `[object ${name}]`;
			return toString.call(obj) === '[object ' + name + ']';
		};
	});

	// Define a fallback version of the method in browsers (ahem, IE < 9), where
	// there isn't any inspectable "Arguments" type.
	//在IE9之下的浏览器中不存在arguments类型的对象，所以需要创建一个后背版本。
	//该版本检测函数通过判断传入的对象是否具有callee属性来判断是否是arguments对象。
	//_.isArguments用于判断传入的参数是否是函数内的arguments对象。
	if (!_.isArguments(arguments)) {
		_.isArguments = function (obj) {
			return _.has(obj, 'callee');
		};
	}

	// Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
	// IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
	var nodelist = root.document && root.document.childNodes;
	if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
		_.isFunction = function (obj) {
			return typeof obj == 'function' || false;
		};
	}

	// Is a given object a finite number?
	//判断给出的对象是否是一个非无穷大的数。
	_.isFinite = function (obj) {
		return !_.isSymbol(obj) && isFinite(obj) && !isNaN(parseFloat(obj));
	};

	// Is the given value `NaN`?
	//判断参数是否是NaN，然而并不是广义上的NaN，因为经过实践证明，很多类型的参数传入到isNaN方法，都会返回true。
	//比如：isNaN(undefined)、isNaN('asd')都会返回true，而不是我们想象中的只有isNaN(NaN)会返回true。
	//这是为什么呢？因为isNaN在判断之前，会进行隐式转换，将某些不能强制转换为数值的非数值转换为数值的时候，也会得到NaN。
	_.isNaN = function (obj) {
		//为了得到我们严格意义上的isNaN(NaN) === true。
		//我们需要确保前提是Object.prototype.toString.call(NaN) === "[object Number]"。
		//避免obj === undefined或者obj === 'abc这种强制转换失败返回NaN导致isNaN函数返回true的情况。
		return _.isNumber(obj) && isNaN(obj);
	};
	//其实ES6引入了Number.isNaN函数，在检测时不会对参数进行强制转换，避免了以上情况的出现。

	// Is a given value a boolean?
	//判断传入参数是否是一个布尔值。
	_.isBoolean = function (obj) {
		return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
	};

	// Is a given value equal to null?
	_.isNull = function (obj) {
		return obj === null;
	};

	// Is a given variable undefined?
	_.isUndefined = function (obj) {
		return obj === void 0;
	};

	// Shortcut function for checking if an object has a given property directly
	// on itself (in other words, not on a prototype).
	//对象是否包含给定的键吗（不是从原型继承来的）？等同于object.hasOwnProperty(key)，
	//但是使用hasOwnProperty 函数的一个安全引用，以防意外覆盖。
	_.has = function (obj, path) {
		//如果path不是一个数组，那么应该就是一个字符串，表示对象属性。
		//直接使用Object.prototype.hasOwnProperty来判断。
		if (!_.isArray(path)) {
			return obj != null && hasOwnProperty.call(obj, path);
		}
		//path是一个数组，先取其长度。
		var length = path.length;
		//循环遍历数组。
		for (var i = 0; i < length; i++) {
			var key = path[i];
			//一旦obj为null或者不含下一个属性，那么直接返回false。
			if (obj == null || !hasOwnProperty.call(obj, key)) {
				return false;
			}
			obj = obj[key];
		}
		return !!length;
	};

	// Utility Functions
	// -----------------

	// Run Underscore.js in *noConflict* mode, returning the `_` variable to its
	// previous owner. Returns a reference to the Underscore object.
	_.noConflict = function () {
		root._ = previousUnderscore;
		return this;
	};

	// Keep the identity function around for default iteratees.
	_.identity = function (value) {
		return value;
	};

	// Predicate-generating functions. Often useful outside of Underscore.
	_.constant = function (value) {
		return function () {
			return value;
		};
	};

	_.noop = function () { };

	_.property = function (path) {
		//如果path不是一个数组，那么应该是一个字符串。
		if (!_.isArray(path)) {
			//那么通过shallowProperty方法获取一个新的函数，该函数可以获取指定对象的path属性。
			return shallowProperty(path);
		}
		return function (obj) {
			//如果path是一个数组，那么通过deepGet获取对应属性的值。
			return deepGet(obj, path);
		};
	};

	// Generates a function for a given object that returns a given property.
	_.propertyOf = function (obj) {
		if (obj == null) {
			return function () { };
		}
		return function (path) {
			return !_.isArray(path) ? obj[path] : deepGet(obj, path);
		};
	};

	// Returns a predicate for checking whether an object has a given set of
	// `key:value` pairs.
	_.matcher = _.matches = function (attrs) {
		attrs = _.extendOwn({}, attrs);
		return function (obj) {
			return _.isMatch(obj, attrs);
		};
	};

	// Run a function **n** times.
	_.times = function (n, iteratee, context) {
		var accum = Array(Math.max(0, n));
		iteratee = optimizeCb(iteratee, context, 1);
		for (var i = 0; i < n; i++) accum[i] = iteratee(i);
		return accum;
	};

	// Return a random integer between min and max (inclusive).
	_.random = function (min, max) {
		if (max == null) {
			max = min;
			min = 0;
		}
		return min + Math.floor(Math.random() * (max - min + 1));
	};

	// A (possibly faster) way to get the current timestamp as an integer.
	//返回一个代表当前时间的时间戳。
	_.now = Date.now || function () {
		return new Date().getTime();
	};

	// List of HTML entities for escaping.
	var escapeMap = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#x27;',
		'`': '&#x60;'
	};
	var unescapeMap = _.invert(escapeMap);

	// Functions for escaping and unescaping strings to/from HTML interpolation.
	var createEscaper = function (map) {
		var escaper = function (match) {
			return map[match];
		};
		// Regexes for identifying a key that needs to be escaped.
		var source = '(?:' + _.keys(map).join('|') + ')';
		var testRegexp = RegExp(source);
		var replaceRegexp = RegExp(source, 'g');
		return function (string) {
			string = string == null ? '' : '' + string;
			return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
		};
	};
	_.escape = createEscaper(escapeMap);
	_.unescape = createEscaper(unescapeMap);

	// Traverses the children of `obj` along `path`. If a child is a function, it
	// is invoked with its parent as context. Returns the value of the final
	// child, or `fallback` if any child is undefined.
	_.result = function (obj, path, fallback) {
		if (!_.isArray(path)) path = [path];
		var length = path.length;
		if (!length) {
			return _.isFunction(fallback) ? fallback.call(obj) : fallback;
		}
		for (var i = 0; i < length; i++) {
			var prop = obj == null ? void 0 : obj[path[i]];
			if (prop === void 0) {
				prop = fallback;
				i = length; // Ensure we don't continue iterating.
			}
			obj = _.isFunction(prop) ? prop.call(obj) : prop;
		}
		return obj;
	};

	// Generate a unique integer id (unique within the entire client session).
	// Useful for temporary DOM ids.
	var idCounter = 0;
	_.uniqueId = function (prefix) {
		var id = ++idCounter + '';
		return prefix ? prefix + id : id;
	};

	// By default, Underscore uses ERB-style template delimiters, change the
	// following template settings to use alternative delimiters.
	_.templateSettings = {
		// 执行JavaScript语句，并将结果插入。
		evaluate: /<%([\s\S]+?)%>/g,
		// 插入变量的值。
		interpolate: /<%=([\s\S]+?)%>/g,
		// 插入变量的值，并进行HTML转义。
		escape: /<%-([\s\S]+?)%>/g
	};

	// When customizing `templateSettings`, if you don't want to define an
	// interpolation, evaluation or escaping regex, we need one that is
	// guaranteed not to match.
	// 一个不可能有匹配项的正则表达式。
	var noMatch = /(.)^/;

	// Certain characters need to be escaped so that they can be put into a
	// string literal.
	// 类似一个字典，将需要转义的字符和其对应转义后的字符对应起来。
	var escapes = {
		"'": "'",
		'\\': '\\',
		'\r': 'r',
		'\n': 'n',
		'\u2028': 'u2028',
		'\u2029': 'u2029'
	};

	// 匹配需要转义字符的正则表达式。
	var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

	// 返回字符对应的转义后的字符。
	var escapeChar = function (match) {
		return '\\' + escapes[match];
	};

	// JavaScript micro-templating, similar to John Resig's implementation.
	// Underscore templating handles arbitrary delimiters, preserves whitespace,
	// and correctly escapes quotes within interpolated code.
	// NB: `oldSettings` only exists for backwards compatibility.
	_.template = function (text, settings, oldSettings) {
		// 如果第二个参数为null或undefined。。等，那么使用oldSettings作为settings。
		if (!settings && oldSettings) settings = oldSettings;
		// 如果三个参数齐整，那么使用整合后的对象作为settings。
		settings = _.defaults({}, settings, _.templateSettings);

		// Combine delimiters into one regular expression via alternation.
		// 匹配占位符的正则表达式。
		var matcher = RegExp([
			(settings.escape || noMatch).source,
			(settings.interpolate || noMatch).source,
			(settings.evaluate || noMatch).source
		].join('|') + '|$', 'g');

		// Compile the template source, escaping string literals appropriately.
		var index = 0;
		var source = "__p+='";
		// function回调作为string.replace的第二个参数会传递至少三个参数，如果有多余捕获的话，也会被作为参数依次传入。
		// string.replace只会返回替换之后的字符串，但是不会对原字符串进行修改，下面的操作实际上没有修改text，只是借用string.replace的回调函数完成新函数的构建。
		text.replace(matcher, function (match, escape, interpolate, evaluate, offset) {
			// 截取没有占位符的字符片段，并且转义其中需要转义的字符。
			source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
			// 跳过占位符，为下一次截取做准备。
			index = offset + match.length;

			// 转义符的位置使用匹配到的占位符中的变量的值替代，构造一个函数的内容。
			if (escape) {
				// 不为空时将转义后的字符串附加到source。
				source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
			} else if (interpolate) {
				source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
			} else if (evaluate) {
				// 由于是直接执行语句，所以直接把evaluate字符串添加到构造函数的字符串中去就好。
				source += "';\n" + evaluate + "\n__p+='";
			}

			// Adobe VMs need the match returned to produce the correct offset.
			// 正常来说没有修改原字符串text，所以不返回值没有关系，但是这里返回了原匹配项，
			// 根据注释的意思，可能是为了防止特殊环境下能够有一个正常的offset偏移量。
			return match;
		});
		source += "';\n";
		// source拼凑出了一个函数定义的所有内容，为后面使用Function构造函数做准备。

		// If a variable is not specified, place data values in local scope.
		// 指定作用域，以取得传入对象数据的所有属性。
		if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

		source = "var __t,__p='',__j=Array.prototype.join," +
			"print=function(){__p+=__j.call(arguments,'');};\n" +
			source + 'return __p;\n';

		var render;
		try {
			// 通过new Function()形式构造函数对象。
			// new Function(param1, ..., paramN, funcBody)
			render = new Function(settings.variable || 'obj', '_', source);
		} catch (e) {
			e.source = source;
			throw e;
		}

		var template = function (data) {
			return render.call(this, data, _);
		};

		// Provide the compiled source as a convenience for precompilation.
		var argument = settings.variable || 'obj';
		// 为template函数添加source属性以便于进行预编译，以便于发现不可重现的错误。
		template.source = 'function(' + argument + '){\n' + source + '}';

		return template;
	};

	// Add a "chain" function. Start chaining a wrapped Underscore object.
	//将传入的对象包装为链式调用的对象，将其标志位置位true。
	_.chain = function (obj) {
		var instance = _(obj);
		instance._chain = true;
		return instance;
	};

	// OOP
	// ---------------
	// If Underscore is called as a function, it returns a wrapped object that
	// can be used OO-style. This wrapper holds altered versions of all the
	// underscore functions. Wrapped objects may be chained.

	// Helper function to continue chaining intermediate results.
	//返回一个链式调用的对象，通过判断instance._chain属性是否为true来决定是否返回链式对象。
	var chainResult = function (instance, obj) {
		return instance._chain ? _(obj).chain() : obj;
	};

	// Add your own custom functions to the Underscore object.
	_.mixin = function (obj) {
		// _.functions函数用于返回一个排序后的数组，包含所有的obj中的函数名。
		_.each(_.functions(obj), function (name) {
			// 先为_对象赋值。
			var func = _[name] = obj[name];
			// 为_的原型添加函数，以增加_(obj).mixin形式的函数调用方法。
			_.prototype[name] = function () {
				// this._wrapped作为第一个参数传递，其他用户传递的参数放在后面。
				var args = [this._wrapped];
				push.apply(args, arguments);
				// 使用chainResult对运算结果进行链式调用处理，如果是链式调用就返回处理后的结果，
				// 如果不是就直接返回运算后的结果。
				return chainResult(this, func.apply(_, args));
			};
		});
		return _;
	};

	// Add all of the Underscore functions to the wrapper object.
	_.mixin(_);

	// Add all mutator Array functions to the wrapper.
	_.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function (name) {
		var method = ArrayProto[name];
		_.prototype[name] = function () {
			var obj = this._wrapped;
			method.apply(obj, arguments);
			if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
			return chainResult(this, obj);
		};
	});

	// Add all accessor Array functions to the wrapper.
	_.each(['concat', 'join', 'slice'], function (name) {
		var method = ArrayProto[name];
		_.prototype[name] = function () {
			return chainResult(this, method.apply(this._wrapped, arguments));
		};
	});

	// Extracts the result from a wrapped and chained object.
	_.prototype.value = function () {
		return this._wrapped;
	};

	// Provide unwrapping proxy for some methods used in engine operations
	// such as arithmetic and JSON stringification.
	_.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

	_.prototype.toString = function () {
		return String(this._wrapped);
	};

	// AMD registration happens at the end for compatibility with AMD loaders
	// that may not enforce next-turn semantics on modules. Even though general
	// practice for AMD registration is to be anonymous, underscore registers
	// as a named module because, like jQuery, it is a base library that is
	// popular enough to be bundled in a third party lib, but not be part of
	// an AMD load request. Those cases could generate an error when an
	// anonymous define() is called outside of a loader request.
	//兼容AMD规范的模块化工具，比如RequireJS。
	if (typeof define == 'function' && define.amd) {
		define('underscore', [], function () {
			return _;
		});
	}
}());
