/**
 * @fileoverview Experiments with sorting algorithms!
 */

/* Generates a non-sorted array of numbers. */
function generateRandomNumberArray(length) {
  var result = [];
  for (var i = 0; i < length; i++) {
    result.push(Math.random());
  }
  return result;
}

/* Swaps the items at two indexes in an array. */
function swap(arr, i, j) {
  var temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;
}

function bubbleSort(nums) {
  for (var run = 0; run < nums.length - 1; run++) {
    for (var i = 0; i < nums.length - run - 1; i++) {
      if (nums[i] > nums[i + 1]) {
        swap(nums, i, i + 1);
      }
    }
  }
  return nums;
}

function selectionSort(nums) {
  for (var i = 0; i < nums.length; i++) {
    swap(nums, i, indexOfMin(nums, i));
  }
  return nums;
}

function indexOfMin(nums, startIndex) {
  if (nums.length == 0) {
    throw Error('Cannot find minimum of empty list.');
  }
  var min = nums[startIndex];
  var minIndex = startIndex;
  for (var i = startIndex + 1; i < nums.length; i++) {
    if (nums[i] < min) {
      min = nums[i];
      minIndex = i;
    }
  }
  return minIndex;
}

function insertionSort(nums) {
  for (var i = 1; i < nums.length; i++) {
    for (var j = i; j > 0 && nums[j - 1] > nums[j]; j--) {
      swap(nums, j - 1, j);
    }
  }
  return nums;
}

function quickSort1(nums) {
  if (nums.length < 2) {
    return nums;
  }
  var pivot = Math.floor(nums.length / 2);
  var lt = [];
  var ge = [];
  for (var i = 0; i < nums.length; i++) {
    if (i == pivot) {
      continue;
    }
    if (nums[i] < nums[pivot]) {
      lt.push(nums[i]);
    } else {
      ge.push(nums[i]);
    }
  }
  return quickSort1(lt) .concat([nums[pivot]]) .concat(quickSort1(ge));
}

function quickSort2(nums) {


function mergeSort(nums) {
  if (nums.length < 2) {
    return nums;
  }
  var mid = Math.floor(nums.length / 2);
  var left = mergeSort(nums.slice(0, mid));
  var right = mergeSort(nums.slice(mid));
  return merge(left, right);
}

function merge(a, b) {
  var aIndex = 0;
  var bIndex = 0;
  var merged = [];
  while (aIndex < a.length && bIndex < b.length) {
    if (a[aIndex] < b[bIndex]) {
      merged.push(a[aIndex]);
      aIndex++;
    } else {
      merged.push(b[bIndex]);
      bIndex++;
    }
  }
  merged = merged.concat(a.slice(aIndex));
  merged = merged.concat(b.slice(bIndex));
  return merged;
}

function makeHeap(arr) {
  for (var i = arr.length - 1; i >= 0; i--) {
    heapFilterUp(i);
  }
}

// Moves an item in a max-heap up to where it belongs.
function heapFilterUp(arr, i) {
  if (i == 0) {
    return;
  }
  var par = heapParent(i);
  if (arr[i] > arr[par]) {
    swap(i, par);
    heapFilterUp(arr, par);
  }
}

// Returns the index of the parent in a heap represented as an array.
function heapParent(i) {
  return Math.floor((i - 1 / 2));
}

// Returns the index of the left child in a heap represented as an array.
function heapLeftChild(i) {
  return i * 2 + 1;
}

// Returns the index of the right child in a heap represented as an array.
function heapRightChild(i) {
  return i * 2 + 2;
}

function isSorted(arr) {
  for (var i = 0; i < arr.length - 1; i++) {
    if (arr[i] > arr[i + 1]) {
      return false;
    }
  }
  return true;
}

var SORT_FUNCTIONS = {
    'Bubble sort': bubbleSort,
    'Selection sort': selectionSort,
    'Insertion sort': insertionSort,
    'Quick sort': quickSort1,
    'Merge sort': mergeSort,
};

function test() {
  var testArray = [6, 2, 7, 3, 1, 4, 9, 5, 8, 0];
  for (var name in SORT_FUNCTIONS) {
    var f = SORT_FUNCTIONS[name];
    var arr = testArray.slice();
    var sorted = f(arr);
    console.log(name, isSorted(arr));
  }
}

/*
 * Runs through various sort functions and outputs results and times.
 */
function time() {
  var n = 4096;
  console.log('Generating number list with', n, 'elements...');
  var numberArray = generateRandomNumberArray(n);
  for (var name in SORT_FUNCTIONS) {
    var f = SORT_FUNCTIONS[name];
    var arr = numberArray.slice();
    var start = Date.now();
    f.call(this, arr);
    var elapsed = Date.now() - start;
    console.log('Ran ' + name + ' in ' + elapsed + ' ms');
  }
}

test();
