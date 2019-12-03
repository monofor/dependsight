import React, { Component } from "react";
import Dropdown from "react-dropdown";
import "react-dropdown/style.css";

export class DependencyRow extends Component {
	allVersions = [];

	dependency = this.props.data.projects[this.props.projectId].dependencies[
		this.props.dependencyId
	];
	constructor(props) {
		super(props);
	}

	componentDidMount() {
		this.props.onRef(this);
	}

	async updateRow() {
		let dependencies = await fetch("/api/dependencies/check", {
			method: "post",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				packageName: this.dependency.name,
				sources: this.props.data.nugetConfig
			})
		});
		const json = await dependencies.json();
		if (!json || json.length === 0) {
			this.dependency.isChecked = true;
			this.dependency.isNotFound = true;
			this.dependency.latestVersion = "Not Found";
			this.dependency.isLatest = false;
			return;
		}
		const value = json[0];
		this.dependency.isChecked = true;
		this.dependency.source = value.source;
		this.dependency.latestVersion = value.version;
		this.dependency.isLatest =
			value.version === this.dependency.currentVersion;
		this.allVersions = json.map(dependency => dependency.version);
	}

	onVersionSelect(selection) {
		this.dependency.latestVersion = selection.value;
	}

	getDependencyClassName() {
		if (!this.dependency.isChecked) return "";

		if (this.dependency.currentVersion === "-No Parameter-")
			return "bg-danger";

		if (this.dependency.isLatest) return "bg-success";

		if (this.dependency.isNotFound) return "bg-danger";

		return "bg-warning";
	}

	getDependencyTextClassName() {
		if (!this.dependency.isChecked) return "";

		if (this.dependency.isLatest) return "font-bold text-success";

		return "font-bold text-warning";
	}

	render() {
		return (
			<tr>
				<td className={this.getDependencyClassName()}></td>
				<td>
					<a
						href={`https://www.nuget.org/packages/${this.dependency.name}/`}
						target="_blank"
						rel="noopener noreferrer"
					>
						{this.dependency.name}
					</a>
					{this.dependency.isParameter && (
						<small className="d-block text-muted">
							Parameter: $({this.dependency.parameterName})
						</small>
					)}
				</td>
				<td className="text-center">
					<span
						className={
							(this.dependency.isParameter ? "text-primary" : "",
							this.dependency.currentVersion === "-No Parameter-"
								? "text-danger"
								: "")
						}
					>
						{this.dependency.currentVersion}
					</span>
				</td>
				<td className="text-center">
					{this.dependency.isChecked ? (
						this.allVersions.length === 0 ? (
							this.dependency.latestVersion
						) : (
							<Dropdown
								options={this.allVersions}
								onChange={this.onVersionSelect.bind(this)}
								value={this.dependency.latestVersion}
								placeholder="Select an option"
							/>
						)
					) : (
						"..."
					)}
				</td>
				<td className="text-center">
					<span className={this.getDependencyTextClassName()}>
						{!this.dependency.isChecked
							? "..."
							: this.dependency.isLatest
							? "Yes"
							: "No"}
					</span>
				</td>
			</tr>
		);
	}
}

export default DependencyRow;
