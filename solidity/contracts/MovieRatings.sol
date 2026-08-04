// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

/// @title MovieRatings - a blockchain-backed movie ratings registry
/// @notice Only the admin can add movies. Anyone can rate a movie 1-5 stars.
///         Each account holds one rating per movie; rating again replaces the
///         previous rating. Rating totals are kept on-chain so averages can
///         be derived without trusting an intermediary.
contract MovieRatings {
    address public immutable admin;

    struct Movie {
        string title;
        uint16 year;
        address addedBy;
        uint256 ratingTotal;
        uint256 ratingCount;
    }

    Movie[] private _movies;

    // movieId => rater => stars (0 means not yet rated)
    mapping(uint256 => mapping(address => uint8)) private _ratings;

    event MovieAdded(
        uint256 indexed movieId,
        string title,
        uint16 year,
        address indexed addedBy
    );

    event MovieRated(
        uint256 indexed movieId,
        address indexed rater,
        uint8 stars,
        uint256 ratingTotal,
        uint256 ratingCount
    );

    constructor(address admin_) {
        require(admin_ != address(0), "MovieRatings: admin required");
        admin = admin_;
    }

    function addMovie(
        string calldata title,
        uint16 year
    ) external returns (uint256 movieId) {
        require(msg.sender == admin, "MovieRatings: only admin");
        require(bytes(title).length > 0, "MovieRatings: title required");

        movieId = _movies.length;
        _movies.push(
            Movie({
                title: title,
                year: year,
                addedBy: msg.sender,
                ratingTotal: 0,
                ratingCount: 0
            })
        );

        emit MovieAdded(movieId, title, year, msg.sender);
    }

    function rateMovie(uint256 movieId, uint8 stars) external {
        require(movieId < _movies.length, "MovieRatings: no such movie");
        require(stars >= 1 && stars <= 5, "MovieRatings: stars must be 1-5");

        uint8 previous = _ratings[movieId][msg.sender];
        _ratings[movieId][msg.sender] = stars;

        Movie storage movie = _movies[movieId];
        movie.ratingTotal = movie.ratingTotal - previous + stars;
        if (previous == 0) {
            movie.ratingCount += 1;
        }

        emit MovieRated(
            movieId,
            msg.sender,
            stars,
            movie.ratingTotal,
            movie.ratingCount
        );
    }

    function getMovieCount() external view returns (uint256) {
        return _movies.length;
    }

    function getMovie(
        uint256 movieId
    )
        external
        view
        returns (
            string memory title,
            uint16 year,
            address addedBy,
            uint256 ratingTotal,
            uint256 ratingCount
        )
    {
        require(movieId < _movies.length, "MovieRatings: no such movie");
        Movie storage movie = _movies[movieId];
        return (
            movie.title,
            movie.year,
            movie.addedBy,
            movie.ratingTotal,
            movie.ratingCount
        );
    }

    function getRating(
        uint256 movieId,
        address rater
    ) external view returns (uint8 stars) {
        require(movieId < _movies.length, "MovieRatings: no such movie");
        return _ratings[movieId][rater];
    }
}
