import React, { Component } from "react";
import GridLoader from "react-spinners/GridLoader";
import DependencyRow from "./DependencyRow";

export class Home extends Component {
	static displayName = Home.name;
	INITIAL_STATE = {
		data: [],
		loading: true,
		updating: false,
		checking: false,
		projectPath: localStorage.getItem("projectPath") || "",
		includePrerelease:
			JSON.parse(localStorage.getItem("includePrerelease")) || false,
		pathError: ""
	};
	constructor(props) {
		super(props);
		this.children = [];
		this.state = this.INITIAL_STATE;
	}

	handleChange = e => {
		localStorage.setItem("projectPath", e.target.value);
		this.setState({
			projectPath: e.target.value.trim()
		});
	};

	handleChangeCheck = e => {
		localStorage.setItem(
			"includePrerelease",
			JSON.stringify(e.target.checked)
		);
		this.setState({
			includePrerelease: e.target.checked
		});
	};

	async getDependencies() {
		this.setState({ data: [], pathError: "" });
		const path = this.state.projectPath;
		const result = await fetch("/api/dependencies", {
			method: "post",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				projectPath: path
			})
		});
		const json = await result.json();
		if (json.error) {
			this.setState({ pathError: json.error });
		} else {
			this.setState({ loading: false, data: json });
		}
	}

	async checkLatestVersions() {
		if (!this.state.projectPath) {
			return this.setState({ pathError: "You should provide a path." });
		}
		if (!this.state.data.projects) {
			return this.setState({
				pathError: "Try to 'Find' your project first."
			});
		}

		this.children.map(async child => {
			this.setState(prev => {
				prev.checking = true;
				prev.pathError = "";
				return prev;
			}, await child.updateRow());
		});

		this.setState({ checking: false, pathError: "" });
	}

	getDependenciesState() {
		const dependencyCount = this.state.data.projects
			.map(project => project.dependencies.length)
			.reduce((x, y) => x + y, 0);

		const dependencyCheckCount = this.state.data.projects
			.map(
				project => project.dependencies.filter(x => x.isChecked).length
			)
			.reduce((x, y) => x + y, 0);

		if (dependencyCount === dependencyCheckCount) {
			this.setState({ checking: false });
		}
		return `[${dependencyCheckCount}/${dependencyCount}]`;
	}

	async updateDependencies() {
		if (!this.state.projectPath)
			return this.setState({ pathError: "You should provide a path." });
		if (!this.state.data.projects) {
			return this.setState({
				pathError: "Try to 'Find' your project first."
			});
		}
		this.setState({ updating: true, pathError: "" });
		const outdatedDependencies = this.state.data.projects
			.map(project =>
				project.dependencies
					.filter(
						dependency =>
							dependency.isChecked &&
							!dependency.isLatest &&
							!dependency.isNotFound
					)
					.map(m => {
						m.project = {
							file: project.file,
							parameterFile: project.parameterFile
						};
						return m;
					})
			)
			.flat();
		const errorProject = outdatedDependencies.find(
			x => x.project && x.project.parameterFile.startsWith("(NOT FOUND!)")
		);
		if (errorProject) {
			alert(
				"One of your projects has invalid parameter file. Fix it first to update your dependencies."
			);
			return;
		}
		const body = JSON.stringify({
			dependencies: outdatedDependencies
		});
		const updateResult = await fetch("/api/dependencies/update", {
			method: "post",
			headers: { "Content-Type": "application/json" },
			body: body
		});
		const json = await updateResult.json();
		if (json.success) {
			this.setState(this.INITIAL_STATE);
			this.getDependencies();
			return;
		}
		alert(
			`Something is wrong with your dependencies;\n\nError Message: ${json.message}`
		);
	}

	componentDidMount() {
		if (this.state.projectPath && this.state.projectPath.length) {
			this.getDependencies();
		}
	}

	render() {
		this.children = [];
		return (
			<div>
				<div className="form-group">
					<label className="control-label">
						Solutions or Projects folder
					</label>
					<div className="input-group mb-3">
						<input
							type="text"
							className={
								"form-control" +
								(this.state.pathError
									? " is-invalid"
									: this.state.data.projects
									? " is-valid"
									: "")
							}
							placeholder="Type your project path"
							onChange={this.handleChange}
							value={this.state.projectPath}
						/>
						<div className="invalid-feedback">
							{this.state.pathError}
						</div>
						<div className="input-group-append">
							<div className="input-group-text">
								<input
									type="checkbox"
									className="form-check-input ml-0"
									defaultChecked={
										this.state.includePrerelease
									}
									onChange={this.handleChangeCheck}
								/>
								<label className="form-check-label ml-3">
									Include Prerelease
								</label>
							</div>
						</div>
						<div className="input-group-append">
							<button
								className="btn btn-secondary"
								type="button"
								onClick={this.getDependencies.bind(this)}
							>
								Find
							</button>{" "}
							<button
								className="btn btn-warning"
								type="button"
								onClick={this.checkLatestVersions.bind(this)}
							>
								Check
							</button>
							<button
								className="btn btn-primary"
								type="button"
								onClick={this.updateDependencies.bind(this)}
							>
								Update
							</button>
						</div>
					</div>
				</div>
				{this.state.updating && (
					<div className="card mb-3">
						<div className="card-body d-flex justify-content-center align-items-center">
							<GridLoader
								sizeUnit={"px"}
								size={8}
								color={"#2DA74E"}
							/>
							<span className="ml-2">
								Updating dependencies...
							</span>
						</div>
					</div>
				)}
				{this.state.checking && (
					<div className="card mb-3">
						<div className="card-body d-flex justify-content-center align-items-center">
							<GridLoader
								sizeUnit={"px"}
								size={8}
								color={"#f00"}
							/>
							<span className="ml-2">
								{this.getDependenciesState()} Checking
								dependencies...
							</span>
						</div>
					</div>
				)}
				{this.state.data && this.state.data.projects && (
					<div className="row">
						<div className="col-sm-6 col-lg-3 mb-3 mb-sm-3">
							<div className="card">
								<div className="card-body py-0 pb-2">
									<span className="display-4">
										{this.state.data.projects.length}
									</span>
									<h5 className="mb-0 text-primary">
										Project
									</h5>
								</div>
							</div>
						</div>
						<div className="col-sm-6 col-lg-3 mb-3 mb-sm-3">
							<div className="card">
								<div className="card-body py-0 pb-2">
									<span className="display-4">
										{this.state.data.projects
											.map(
												project =>
													project.dependencies.length
											)
											.reduce((x, y) => x + y, 0)}
									</span>
									<h5 className="mb-0 text-warning">
										Dependencies
									</h5>
								</div>
							</div>
						</div>
						<div className="col-sm-6 col-lg-3 mb-3">
							<div className="card">
								<div className="card-body py-0 pb-2">
									<span className="display-4">
										{this.state.data.projects
											.map(
												project =>
													project.dependencies.filter(
														dependency =>
															!dependency.isLatest
													).length
											)
											.reduce((x, y) => x + y, 0)}
									</span>
									<h5 className="mb-0 text-danger">
										Outdated
									</h5>
								</div>
							</div>
						</div>
						<div className="col-sm-6 col-lg-3 mb-3">
							<div className="card">
								<div className="card-body py-0 pb-2">
									<span className="display-4">
										{this.state.data.projects
											.map(
												project =>
													project.dependencies.filter(
														dependency =>
															dependency.isLatest
													).length
											)
											.reduce((x, y) => x + y, 0)}
									</span>
									<h5 className="mb-0 text-success">
										Up to date
									</h5>
								</div>
							</div>
						</div>
					</div>
				)}
				{this.state.data &&
					this.state.data.projects &&
					this.state.data.projects
						.filter(item => item.dependencies.length)
						.map((item, projectIdx) => (
							<div
								className="card mb-3 shadow-sm"
								key={item.file}
							>
								<div className="card-body p-2">
									<h5 className="mb-0">
										<span>{item.name}</span>
										<span
											className="mt-1 d-block text-muted"
											style={{ fontSize: "9pt" }}
										>
											{item.file}
										</span>
										{item.parameterFile && (
											<span
												className={
													"mt-1 d-block " +
													(item.parameterFile.indexOf(
														"(NOT FOUND!)"
													) === 0
														? "text-danger"
														: "text-primary")
												}
												style={{ fontSize: "9pt" }}
											>
												{item.parameterFile}
											</span>
										)}
									</h5>
								</div>
								<table className="table table-hover table-sm mb-0 text-monospace">
									<thead>
										<tr>
											<th
												style={{ width: "20px" }}
												className="text-center"
											>
												#
											</th>
											<th style={{ width: "70%" }}>
												Package
											</th>
											<th
												style={{ width: "10%" }}
												className="text-center"
											>
												Version
											</th>
											<th
												style={{ width: "10%" }}
												className="text-center"
											>
												Latest
											</th>
											<th
												style={{ width: "10%" }}
												className="text-center"
											>
												Is Latest
											</th>
										</tr>
									</thead>
									<tbody>
										{item.dependencies.map(
											(dependency, idx) => (
												<DependencyRow
													key={`${item.file}:${dependency.name}`}
													onRef={ref =>
														this.children.push(ref)
													}
													includePrerelease={
														this.state
															.includePrerelease
													}
													data={this.state.data}
													projectId={projectIdx}
													dependencyId={idx}
												/>
											)
										)}
									</tbody>
								</table>
							</div>
						))}
				<pre className="d-none">
					{JSON.stringify(this.state.data, true, 4)}
				</pre>
			</div>
		);
	}
}
