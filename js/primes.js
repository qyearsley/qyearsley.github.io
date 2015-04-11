
function primes(max) {
	var primesList = [];
	for (num = 1; num <= max; num+=2) {
		isPrime = false;
		for (factor = 2; (num % factor != 0) && (!isPrime); factor++) {
			if (factor > num / 2) {
				primesList.push(num);
				isPrime = true;
			}
		}
	}
	return primesList;
}
