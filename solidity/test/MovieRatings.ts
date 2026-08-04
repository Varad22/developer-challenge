import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("MovieRatings", function () {
  async function deployMovieRatings() {
    const [admin, alice, bob] = await ethers.getSigners();
    const MovieRatings = await ethers.getContractFactory("MovieRatings");
    const movieRatings = await MovieRatings.deploy(admin.address);

    return { movieRatings, admin, alice, bob };
  }

  describe("addMovie", function () {
    it("adds a movie and emits MovieAdded", async function () {
      const { movieRatings, admin } = await loadFixture(deployMovieRatings);

      await expect(movieRatings.addMovie("The Matrix", 1999))
        .to.emit(movieRatings, "MovieAdded")
        .withArgs(0, "The Matrix", 1999, admin.address);

      expect(await movieRatings.getMovieCount()).to.equal(1);

      const movie = await movieRatings.getMovie(0);
      expect(movie.title).to.equal("The Matrix");
      expect(movie.year).to.equal(1999);
      expect(movie.ratingTotal).to.equal(0);
      expect(movie.ratingCount).to.equal(0);
    });

    it("rejects a non-admin caller", async function () {
      const { movieRatings, alice } = await loadFixture(deployMovieRatings);

      await expect(
        movieRatings.connect(alice).addMovie("The Matrix", 1999)
      ).to.be.revertedWith("MovieRatings: only admin");
    });

    it("rejects an empty title", async function () {
      const { movieRatings } = await loadFixture(deployMovieRatings);

      await expect(movieRatings.addMovie("", 2000)).to.be.revertedWith(
        "MovieRatings: title required"
      );
    });

    it("assigns sequential ids", async function () {
      const { movieRatings } = await loadFixture(deployMovieRatings);

      await movieRatings.addMovie("Alien", 1979);
      await expect(movieRatings.addMovie("Aliens", 1986))
        .to.emit(movieRatings, "MovieAdded")
        .withArgs(1, "Aliens", 1986, anyValue);

      expect(await movieRatings.getMovieCount()).to.equal(2);
    });
  });

  describe("rateMovie", function () {
    it("records a rating and emits MovieRated", async function () {
      const { movieRatings, alice } = await loadFixture(deployMovieRatings);
      await movieRatings.addMovie("The Matrix", 1999);

      await expect(movieRatings.connect(alice).rateMovie(0, 5))
        .to.emit(movieRatings, "MovieRated")
        .withArgs(0, alice.address, 5, 5, 1);

      const movie = await movieRatings.getMovie(0);
      expect(movie.ratingTotal).to.equal(5);
      expect(movie.ratingCount).to.equal(1);
      expect(await movieRatings.getRating(0, alice.address)).to.equal(5);
    });

    it("aggregates ratings from multiple accounts", async function () {
      const { movieRatings, alice, bob } = await loadFixture(
        deployMovieRatings
      );
      await movieRatings.addMovie("The Matrix", 1999);

      await movieRatings.connect(alice).rateMovie(0, 5);
      await movieRatings.connect(bob).rateMovie(0, 2);

      const movie = await movieRatings.getMovie(0);
      expect(movie.ratingTotal).to.equal(7);
      expect(movie.ratingCount).to.equal(2);
    });

    it("lets an account update its rating without double counting", async function () {
      const { movieRatings, alice, bob } = await loadFixture(
        deployMovieRatings
      );
      await movieRatings.addMovie("The Matrix", 1999);

      await movieRatings.connect(alice).rateMovie(0, 4);
      await movieRatings.connect(bob).rateMovie(0, 3);

      await expect(movieRatings.connect(alice).rateMovie(0, 1))
        .to.emit(movieRatings, "MovieRated")
        .withArgs(0, alice.address, 1, 4, 2);

      const movie = await movieRatings.getMovie(0);
      expect(movie.ratingTotal).to.equal(4);
      expect(movie.ratingCount).to.equal(2);
      expect(await movieRatings.getRating(0, alice.address)).to.equal(1);
    });

    it("rejects stars outside 1-5", async function () {
      const { movieRatings } = await loadFixture(deployMovieRatings);
      await movieRatings.addMovie("The Matrix", 1999);

      await expect(movieRatings.rateMovie(0, 0)).to.be.revertedWith(
        "MovieRatings: stars must be 1-5"
      );
      await expect(movieRatings.rateMovie(0, 6)).to.be.revertedWith(
        "MovieRatings: stars must be 1-5"
      );
    });

    it("rejects rating a movie that does not exist", async function () {
      const { movieRatings } = await loadFixture(deployMovieRatings);

      await expect(movieRatings.rateMovie(99, 3)).to.be.revertedWith(
        "MovieRatings: no such movie"
      );
    });
  });
});